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
        self.assertEqual(data["dataset_kind"], "ctu13")
        self.assertEqual(data["dataset_id"], "ctu13_c47")
        self.assertEqual(data["total_events"], 1068851)
        self.assertEqual(data["malicious_events"], 9256)
        self.assertEqual(data["benign_events"], 1059595)
        self.assertEqual(data["pipeline_status"], "ready")

    def test_events_filtering(self):
        # Total
        r_all = client.get("/api/events")
        self.assertEqual(r_all.status_code, 200)
        self.assertEqual(r_all.json()["total"], 3)

        # Malicious only
        r_mal = client.get("/api/events?label=1")
        self.assertEqual(r_mal.status_code, 200)
        self.assertEqual(r_mal.json()["total"], 2)

        # Relation filter
        r_flow = client.get("/api/events?relations=NETWORK_FLOW")
        self.assertEqual(r_flow.status_code, 200)
        self.assertEqual(r_flow.json()["total"], 3)

    def test_attack_chains_three_strategies(self):
        r_chains = client.get("/api/chains")
        self.assertEqual(r_chains.status_code, 200)
        chains = r_chains.json()
        self.assertGreaterEqual(len(chains), 1)

        c0 = chains[0]
        self.assertEqual(c0["chain_id"], "inferred_ctu13_0")
        self.assertEqual(c0["strategy"], "entity_time")

        r_evts = client.get(f"/api/chains/{c0["chain_id"]}/events")
        self.assertEqual(r_evts.status_code, 200)
        self.assertEqual(len(r_evts.json()), 2)

    def test_model_summary_dynamic_parameters(self):
        resp = client.get("/api/model/summary")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["architecture"], "TemporalGNN")
        self.assertTrue(data["checkpoint_inspected"])
        # Parameters calculated programmatically from active checkpoint state_dict
        self.assertEqual(data["trainable_parameters"], 83651)
        self.assertEqual(data["non_trainable_parameters"], 0)
        self.assertEqual(data["total_parameters"], 83651)

    def test_evaluation_test_split_exact_artifact_metrics(self):
        resp = client.get("/api/model/evaluation?split=test")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        metrics = data["metrics"]
        self.assertEqual(metrics["num_samples"], 216347)
        self.assertEqual(metrics["num_positive"], 1831)
        self.assertEqual(metrics["num_negative"], 214516)
        self.assertAlmostEqual(metrics["accuracy"], 0.999584, places=4)
        self.assertAlmostEqual(metrics["precision"], 0.95888, places=4)
        self.assertAlmostEqual(metrics["recall"], 0.99345, places=4)
        self.assertAlmostEqual(metrics["f1"], 0.97586, places=4)
        self.assertAlmostEqual(metrics["auc_roc"], 0.99998, places=4)
        self.assertAlmostEqual(metrics["auc_pr"], 0.99760, places=4)
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
        self.assertGreaterEqual(len(ds), 1)
        ids = [d["id"] for d in ds]
        self.assertIn("ctu13_c47", ids)
        ctu = next(d for d in ds if d["id"] == "ctu13_c47")
        self.assertEqual(ctu["kind"], "ctu13")
        self.assertEqual(ctu["num_raw_events"], 1068851)

        r_jobs = client.get("/api/jobs")
        self.assertEqual(r_jobs.status_code, 200)
        jobs = r_jobs.json()
        self.assertEqual(len(jobs), 1)
        self.assertIsNone(jobs[0]["started_at"])
        self.assertIsNone(jobs[0]["completed_at"])
        self.assertEqual(jobs[0]["elapsed_s"], 14.82)

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
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["epochs_total"], 5)
        self.assertEqual(data["best_epoch"], 5)
        self.assertAlmostEqual(data["best_metric_value"], 0.916585, places=4)
        self.assertIn("config", data)
        cfg = data["config"]
        self.assertEqual(cfg["epochs"], 5)
        self.assertEqual(cfg["lr"], 0.001)
        self.assertEqual(cfg["batch_size"], 8)
        self.assertEqual(cfg["window_size"], 10)
        self.assertEqual(cfg["hidden_channels"], 128)
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
        self.assertEqual(norm["seen"], 1068851)
        self.assertEqual(norm["accepted"], 1068851)
        self.assertEqual(norm["rejected"], 0)
        labeling = data["labeling"]
        self.assertEqual(labeling["benign_events"], 1059595)
        self.assertEqual(labeling["malicious_events"], 9256)
        self.assertEqual(labeling["total_events"], 1068851)

if __name__ == "__main__":
    unittest.main()
