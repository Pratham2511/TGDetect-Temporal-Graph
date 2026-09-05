import unittest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from starlette.testclient import TestClient
from api.main import app

client = TestClient(app)

class TestApiIntegration(unittest.TestCase):
    def test_health(self):
        resp = client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["backend"], "local")

    def test_overview(self):
        resp = client.get("/api/overview")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["dataset_kind"], "synthetic_demo")
        self.assertEqual(data["total_events"], 1219)
        self.assertEqual(data["total_nodes"], 45)
        self.assertEqual(data["total_edges"], 1219)
        self.assertEqual(data["malicious_events"], 19)
        self.assertEqual(data["benign_events"], 1200)
        self.assertEqual(data["chain_count"], 3)
        self.assertAlmostEqual(data["time_span_s"], 12074.5652282238, places=4)

    def test_events_filtering(self):
        # Total
        r_all = client.get("/api/events")
        self.assertEqual(r_all.status_code, 200)
        self.assertEqual(r_all.json()["total"], 1219)

        # Malicious only
        r_mal = client.get("/api/events?label=1")
        self.assertEqual(r_mal.status_code, 200)
        self.assertEqual(r_mal.json()["total"], 19)

        # Relation filter
        r_exec = client.get("/api/events?relations=EXECUTES")
        self.assertEqual(r_exec.status_code, 200)
        self.assertEqual(r_exec.json()["total"], 178)

    def test_attack_chains_three_strategies(self):
        r_chains = client.get("/api/chains")
        self.assertEqual(r_chains.status_code, 200)
        chains = r_chains.json()
        self.assertEqual(len(chains), 3)

        strategies = {c["strategy"]: c["chain_id"] for c in chains}
        self.assertIn("chain_id", strategies)
        self.assertIn("causal_parent", strategies)
        self.assertIn("entity_time", strategies)

        # 1. Strategy: chain_id
        c_id = strategies["chain_id"]
        r_evts = client.get(f"/api/chains/{c_id}/events")
        self.assertEqual(r_evts.status_code, 200)
        self.assertEqual(len(r_evts.json()), 8)

        # 2. Strategy: causal_parent
        cp_id = strategies["causal_parent"]
        r_cp_evts = client.get(f"/api/chains/{cp_id}/events")
        self.assertEqual(r_cp_evts.status_code, 200)
        self.assertEqual(len(r_cp_evts.json()), 6)

        # 3. Strategy: entity_time
        et_id = strategies["entity_time"]
        r_et_evts = client.get(f"/api/chains/{et_id}/events")
        self.assertEqual(r_et_evts.status_code, 200)
        self.assertEqual(len(r_et_evts.json()), 5)

        # Total malicious across all 3 chains: 8 + 6 + 5 = 19
        total_chain_evts = len(r_evts.json()) + len(r_cp_evts.json()) + len(r_et_evts.json())
        self.assertEqual(total_chain_evts, 19)

    def test_model_summary_dynamic_parameters(self):
        resp = client.get("/api/model/summary")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["architecture"], "TemporalGNN")
        self.assertTrue(data["checkpoint_inspected"])
        # Parameters calculated programmatically from best_model.pt state_dict
        self.assertEqual(data["trainable_parameters"], 36098)
        self.assertEqual(data["non_trainable_parameters"], 0)
        self.assertEqual(data["total_parameters"], 36098)
        self.assertEqual(data["bn_running_stats"], 258)
        self.assertEqual(data["total_state_dict_elements"], 36356)

    def test_evaluation_test_split_exact_artifact_metrics(self):
        resp = client.get("/api/model/evaluation?split=test")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        metrics = data["metrics"]
        self.assertEqual(metrics["num_samples"], 20290)
        self.assertEqual(metrics["num_positive"], 1072)
        self.assertEqual(metrics["num_negative"], 19218)
        self.assertAlmostEqual(metrics["accuracy"], 0.05283390832922622, places=6)
        self.assertAlmostEqual(metrics["precision"], 0.05283390832922622, places=6)
        self.assertEqual(metrics["recall"], 1.0)
        self.assertAlmostEqual(metrics["f1"], 0.10036513435071623, places=6)
        self.assertAlmostEqual(metrics["auc_roc"], 0.7447019167742306, places=6)
        self.assertAlmostEqual(metrics["auc_pr"], 0.23626491059089688, places=6)
        self.assertEqual(metrics["confusion_matrix"], {"tn": 0, "fp": 19218, "fn": 0, "tp": 1072})
        # Honest timestamps: no fabricated timestamps
        self.assertIsNone(data["started_at"])
        self.assertIsNone(data["ended_at"])

    def test_evaluation_unevaluated_split_returns_404(self):
        resp = client.get("/api/model/evaluation?split=val")
        self.assertEqual(resp.status_code, 404)

    def test_datasets_and_jobs(self):
        r_ds = client.get("/api/datasets")
        self.assertEqual(r_ds.status_code, 200)
        ds = r_ds.json()
        self.assertEqual(len(ds), 1)
        self.assertEqual(ds[0]["kind"], "synthetic_demo")
        self.assertEqual(ds[0]["num_raw_events"], 1219)

        r_jobs = client.get("/api/jobs")
        self.assertEqual(r_jobs.status_code, 200)
        jobs = r_jobs.json()
        self.assertEqual(len(jobs), 1)
        self.assertIsNone(jobs[0]["started_at"])
        self.assertIsNone(jobs[0]["completed_at"])
        self.assertEqual(jobs[0]["elapsed_s"], 1.24)

    def test_artifacts_path_traversal_protection(self):
        resp = client.get("/api/artifacts/../../etc/passwd")
        self.assertEqual(resp.status_code, 404)

    def test_snapshots_schema_and_malicious_counts(self):
        resp = client.get("/api/model/snapshots?limit=70")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("snapshots", data)
        self.assertGreater(len(data["snapshots"]), 0)
        s0 = data["snapshots"][0]
        self.assertIn("index", s0)
        self.assertIn("sequence", s0)
        self.assertIn("num_nodes", s0)
        self.assertIn("num_edges", s0)
        self.assertIn("num_malicious_nodes", s0)
        self.assertIn("num_malicious_edges", s0)
        self.assertIn("snapshot_label", s0)
        # Explicit test: snapshot 23 has 3 malicious edges out of 40 total edges.
        # This proves malicious edge counts are derived from snapshot edge_labels, NOT snapshot_label.
        s23 = next((s for s in data["snapshots"] if s["sequence"] == 23), None)
        self.assertIsNotNone(s23)
        self.assertEqual(s23["snapshot_label"], 1)
        self.assertEqual(s23["num_edges"], 40)
        self.assertEqual(s23["num_malicious_edges"], 3)
        # Snapshot 24 has 7 malicious edges out of 40 total edges
        s24 = next((s for s in data["snapshots"] if s["sequence"] == 24), None)
        self.assertIsNotNone(s24)
        self.assertEqual(s24["snapshot_label"], 1)
        self.assertEqual(s24["num_edges"], 40)
        self.assertEqual(s24["num_malicious_edges"], 7)

    def test_training_run_config_and_history(self):
        resp = client.get("/api/model/training")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], "mordor-mixed-run-01")
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["epochs_total"], 5)
        self.assertEqual(data["best_epoch"], 1)
        self.assertEqual(data["best_metric"], "best_val_f1")
        self.assertAlmostEqual(data["best_metric_value"], 0.9139796023488205, places=6)
        self.assertIn("config", data)
        cfg = data["config"]
        self.assertEqual(cfg["epochs"], 5)
        self.assertEqual(cfg["lr"], 0.001)
        self.assertEqual(cfg["batch_size"], 8)
        self.assertEqual(cfg["window_size"], 10)
        self.assertEqual(cfg["hidden_channels"], 64)
        self.assertEqual(cfg["out_channels"], 64)
        self.assertEqual(cfg["gnn_layers"], 2)
        self.assertEqual(cfg["rnn_layers"], 1)
        self.assertEqual(cfg["dropout"], 0.3)
        self.assertEqual(cfg["seed"], 42)
        self.assertIsNone(cfg["pos_weight"])
        self.assertEqual(len(data["history"]), 5)

    def test_graph_stats_normalization_and_labeling(self):
        resp = client.get("/api/graph/stats")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        norm = data["normalization"]
        self.assertEqual(norm["seen"], 1219)
        self.assertEqual(norm["accepted"], 1219)
        self.assertEqual(norm["rejected"], 0)
        labeling = data["labeling"]
        self.assertEqual(labeling["benign_events"], 1200)
        self.assertEqual(labeling["malicious_events"], 19)
        self.assertEqual(labeling["total_events"], 1219)

if __name__ == "__main__":
    unittest.main()
