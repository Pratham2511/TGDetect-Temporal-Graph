import unittest
import tempfile
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq

from graph_builder.parsers import _ctu13_ts, _ctu13_int, _ctu13_float, parse_ctu13_binetflow, PARSERS
from graph_builder.schema import TGEvent, NodeType, RelationType, EDGE_SCHEMA, EDGE_OPTIONAL_COLUMNS
from graph_builder.loader import TemporalGraphDataset, load_graph, _validate_schema
from graph_builder.temporal import SnapshotBuilder, TemporalSnapshot, FLOW_FEATURE_DIM
from graph_builder.builder import StreamingGraphBuilder
from graph_builder.exporters import GraphExporter, write_stats
from api.services.model_service import ModelService
from api.dependencies import BASE_DIR


class TestCTU13Pipeline(unittest.TestCase):
    def test_timestamp_parser(self):
        # CTU-13 format: YYYY/MM/DD HH:MM:SS.ffffff
        raw = "2011/08/18 15:40:53.826372"
        ts = _ctu13_ts(raw)
        self.assertIsNotNone(ts)
        self.assertAlmostEqual(ts, 1313682053.826372, places=2)

        # Plain second format
        ts2 = _ctu13_ts("2011/08/18 15:40:53")
        self.assertIsNotNone(ts2)
        self.assertEqual(ts2, 1313682053.0)

        # Invalid returns None
        self.assertIsNone(_ctu13_ts(""))
        self.assertIsNone(_ctu13_ts("not a date"))

    def test_int_and_port_parser(self):
        self.assertEqual(_ctu13_int("80"), 80)
        self.assertEqual(_ctu13_int("0x0050"), 80)
        self.assertEqual(_ctu13_int("0x1a"), 26)
        self.assertEqual(_ctu13_int(""), None)
        self.assertEqual(_ctu13_int("bad"), None)

    def test_float_parser(self):
        self.assertEqual(_ctu13_float("3.1415"), 3.1415)
        self.assertEqual(_ctu13_float(""), None)
        self.assertEqual(_ctu13_float("invalid"), None)

    def test_ctu13_binetflow_parser_streaming(self):
        # Create a sample CTU-13 binetflow content
        content = (
            "StartTime,Dur,Proto,SrcAddr,Sport,Dir,DstAddr,Dport,State,sTos,dTos,TotPkts,TotBytes,SrcBytes,Label\n"
            "2011/08/18 15:40:53.826372,1.0234,tcp,147.32.84.165,1025,->,147.32.80.9,53,CON,0,0,2,150,75,flow=From-Botnet-V52-1-TCP-HTTP-Google-Net-1\n"
            "2011/08/18 15:40:54.100000,0.5000,udp,147.32.84.170,0x0035,<->,147.32.80.9,53,INT,0,0,4,300,150,flow=From-Normal-V52-UDP-DNS\n"
            "2011/08/18 15:40:55.200000,2.1000,tcp,147.32.84.180,443,->,147.32.80.9,443,CON,0,0,10,1200,600,flow=Background-TCP-Established\n"
        )
        with tempfile.NamedTemporaryFile(mode="w", suffix=".binetflow", delete=False) as tf:
            tf.write(content)
            tf_path = tf.name

        try:
            # 1. Parse with background=benign (default)
            events = list(parse_ctu13_binetflow(tf_path, background="benign"))
            self.assertEqual(len(events), 3)

            # Check botnet event (row 1)
            e0 = events[0]
            self.assertEqual(e0.label, 1)
            self.assertEqual(e0.src_id, "ip:147.32.84.165")
            self.assertEqual(e0.dst_id, "ip:147.32.80.9")
            self.assertEqual(e0.relation, RelationType.NETWORK_FLOW.value)
            self.assertEqual(e0.attrs["proto"], "tcp")
            self.assertEqual(e0.attrs["sport"], 1025)
            self.assertEqual(e0.attrs["dport"], 53)
            self.assertEqual(e0.attrs["tot_pkts"], 2)

            # Check normal event (row 2)
            e1 = events[1]
            self.assertEqual(e1.label, 0)
            self.assertEqual(e1.attrs["sport"], 53)  # parsed hex 0x0035 -> 53

            # Check background event (row 3)
            e2 = events[2]
            self.assertEqual(e2.label, 0)

            # 2. Parse with background=drop
            events_drop = list(parse_ctu13_binetflow(tf_path, background="drop"))
            self.assertEqual(len(events_drop), 2)  # background dropped
            self.assertEqual(events_drop[0].label, 1)
            self.assertEqual(events_drop[1].label, 0)
        finally:
            Path(tf_path).unlink(missing_ok=True)

    def test_edge_row_and_schema_validation(self):
        event = TGEvent(
            event_id="ctu13_0",
            ts=1313682053.826372,
            src_id="ip:10.0.0.1",
            src_type=NodeType.IP.value,
            dst_id="ip:10.0.0.2",
            dst_type=NodeType.IP.value,
            relation=RelationType.NETWORK_FLOW.value,
            label=1,
            source_tag="ctu13_test",
            attrs={
                "dur": 1.5,
                "proto": "tcp",
                "sport": 12345,
                "dport": 80,
                "dir": "->",
                "state": "CON",
                "stos": 0,
                "dtos": 0,
                "tot_pkts": 5,
                "tot_bytes": 500,
                "src_bytes": 250,
            }
        )
        row = event.edge_row()
        self.assertEqual(row["flow_dur"], 1.5)
        self.assertEqual(row["flow_proto"], "tcp")
        self.assertEqual(row["flow_sport"], 12345)
        self.assertEqual(row["flow_dport"], 80)
        self.assertEqual(row["flow_tot_pkts"], 5)
        self.assertEqual(row["flow_tot_bytes"], 500)

        # Verify EDGE_OPTIONAL_COLUMNS contains all flow_* keys
        for key in ["flow_dur", "flow_proto", "flow_sport", "flow_dport", "flow_dir", "flow_state", "flow_tot_bytes"]:
            self.assertIn(key, EDGE_OPTIONAL_COLUMNS)

    def test_flow_snapshot_features_and_source_only_label(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            events = [
                TGEvent(
                    event_id=f"flow-{i}",
                    ts=1313682000.0 + i * 2,
                    src_id=f"ip:192.168.1.{10 + (i % 3)}",
                    src_type=NodeType.IP.value,
                    dst_id="ip:10.0.0.1",
                    dst_type=NodeType.IP.value,
                    relation=RelationType.NETWORK_FLOW.value,
                    label=1 if i % 4 == 0 else 0,
                    source_tag="ctu13_c52",
                    attrs={
                        "dur": 0.5 + i * 0.1,
                        "proto": "tcp" if i % 2 == 0 else "udp",
                        "sport": 1024 + i,
                        "dport": 80 if i % 2 == 0 else 53,
                        "dir": "->",
                        "state": "CON" if i % 2 == 0 else "INT",
                        "stos": 0,
                        "dtos": 0,
                        "tot_pkts": 10 + i,
                        "tot_bytes": 1000 + i * 100,
                        "src_bytes": 500 + i * 50,
                    }
                )
                for i in range(20)
            ]

            builder = StreamingGraphBuilder()
            exporter = GraphExporter(str(root), write_edges=True)
            for evt in exporter.stream_events(builder.add_events(events)):
                pass
            exporter.write_nodes(builder.node_rows())
            exporter.close()
            write_stats(str(root), builder.summary())

            ds = load_graph(root)
            snap_builder = SnapshotBuilder(
                ds,
                window_size_s=20.0,
                stride_s=10.0,
                node_feature_mode="type_only",
                edge_feature_mode="flow",
                scenario_id="52"
            )

            # Check feature dimension
            expected_dim = len(ds.relations) + FLOW_FEATURE_DIM + 1
            self.assertEqual(snap_builder.edge_feature_dim, expected_dim)

            snaps = snap_builder.build_all()
            self.assertGreater(len(snaps), 0)
            s0 = snaps[0]
            self.assertEqual(s0.edge_attr.shape[1], expected_dim)
            self.assertEqual(s0.scenario_id, "52")

            # Crucial check: destination node (victim ip:10.0.0.1) must NOT be labeled malicious
            dst_idx = s0.node_ids.index("ip:10.0.0.1")
            self.assertEqual(s0.node_labels[dst_idx], 0, "Victim/destination node must remain 0 under source-only rule")

    def test_checkpoint_inspection_and_ctu13_artifacts(self):
        ctu13_ckpt = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "best_model.pt"
        if not ctu13_ckpt.exists():
            self.skipTest("ctu13_ho_c47/best_model.pt artifact not found")

        info = ModelService._inspect_checkpoint(ctu13_ckpt)
        self.assertTrue(info["exists"])
        self.assertTrue(info["has_edge_classifier"])
        self.assertEqual(info["target"], "edge")
        self.assertIn("train_scenarios", info["split_manifest"])
        self.assertIn("test_scenarios", info["split_manifest"])

        cfg = ModelService.get_config(ctu13_ckpt)
        self.assertEqual(cfg["in_channels"], 1)
        self.assertEqual(cfg["edge_dim"], 37)
        self.assertTrue(cfg["has_edge_classifier"])

        summary = ModelService.get_summary(ctu13_ckpt)
        self.assertIn("edge_classifier", summary["output_heads"])
        self.assertTrue(any(l["name"] == "edge_classifier" for l in summary["layers"]))

    def test_evaluation_runs_ctu13_and_mordor_coexistence(self):
        runs = ModelService.get_evaluation_runs()
        run_ids = [r["id"] for r in runs]
        self.assertIn("eval_test_mordor_mixed", run_ids)

        ctu13_eval = BASE_DIR / "models" / "checkpoints" / "ctu13_ho_c47" / "eval_test" / "metrics_test.json"
        if ctu13_eval.exists():
            self.assertIn("eval_test_ctu13_ho_c47", run_ids)
            ctu_run = next(r for r in runs if r["id"] == "eval_test_ctu13_ho_c47")
            m = ctu_run["metrics"]
            self.assertAlmostEqual(m["f1"], 0.8388, places=2)
            self.assertAlmostEqual(m["accuracy"], 0.9968, places=2)
            self.assertAlmostEqual(m["recall_at_1pct_fpr"], 0.9957, places=2)
            self.assertIsNotNone(m["confusion_matrix"])


if __name__ == "__main__":
    unittest.main()
