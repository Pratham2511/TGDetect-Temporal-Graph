import io
import tempfile
import unittest
from starlette.testclient import TestClient
from api.main import app
from api.services.dataset_validator import DatasetValidator

client = TestClient(app)


class TestDatasetValidation(unittest.TestCase):
    def test_detect_ctu13_and_validate(self):
        content = (
            "StartTime,Dur,Proto,SrcAddr,Sport,Dir,DstAddr,Dport,State,sTos,dTos,TotPkts,TotBytes,SrcBytes,Label\n"
            "2011/08/18 10:19:13.327893,1.0,tcp,147.32.84.165,1027,->,147.32.80.9,53,CON,0,0,2,142,68,flow=From-Botnet-V42-UDP-DNS\n"
            "2011/08/18 10:19:14.500000,0.5,udp,147.32.84.165,1028,->,147.32.80.9,53,INT,0,0,1,70,70,flow=From-Normal-V42-UDP\n"
        )
        with tempfile.NamedTemporaryFile(suffix=".binetflow", mode="w", delete=False) as f:
            f.write(content)
            path = f.name

        det = DatasetValidator.detect_format(path)
        self.assertEqual(det["format"], "ctu13")

        res = DatasetValidator.validate_file(path)
        self.assertEqual(res["status"], "valid")
        self.assertEqual(res["valid_rows"], 2)
        self.assertEqual(res["invalid_rows"], 0)
        self.assertEqual(len(res["sample_events"]), 2)
        self.assertEqual(res["sample_events"][0]["label"], 1)
        self.assertEqual(res["sample_events"][1]["label"], 0)

    def test_validate_ctu13_invalid_columns(self):
        content = "StartTime,Proto,Label\n2011/08/18 10:19:13,tcp,Normal\n"
        with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
            f.write(content)
            path = f.name

        res = DatasetValidator.validate_file(path, format_name="ctu13")
        self.assertEqual(res["status"], "invalid")
        self.assertGreater(len(res["missing_required_columns"]), 0)
        self.assertIn("SrcAddr", res["missing_required_columns"])

    def test_validate_ctu13_invalid_timestamp(self):
        content = (
            "StartTime,Dur,Proto,SrcAddr,Sport,Dir,DstAddr,Dport,State,sTos,dTos,TotPkts,TotBytes,SrcBytes,Label\n"
            "bad-time,1.0,tcp,10.0.0.1,1027,->,10.0.0.2,53,CON,0,0,2,142,68,Normal\n"
        )
        with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as f:
            f.write(content)
            path = f.name

        res = DatasetValidator.validate_file(path, format_name="ctu13")
        self.assertEqual(res["status"], "invalid")
        self.assertIn("Invalid StartTime timestamp", res["errors"][0]["message"])

    def test_api_upload_endpoint(self):
        import os
        csv_data = (
            "StartTime,Dur,Proto,SrcAddr,Sport,Dir,DstAddr,Dport,State,sTos,dTos,TotPkts,TotBytes,SrcBytes,Label\n"
            "2011/08/18 10:19:13.327893,1.0,tcp,147.32.84.165,1027,->,147.32.80.9,53,CON,0,0,2,142,68,flow=From-Botnet\n"
        ).encode("utf-8")

        files = {"file": ("test_upload.binetflow", io.BytesIO(csv_data), "text/csv")}
        resp = client.post("/api/datasets/upload", files=files)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "valid")
        self.assertEqual(data["format"], "ctu13")
        self.assertEqual(data["valid_rows"], 1)
        self.assertIn("saved_path", data)
        # Clean up uploaded test file
        if "saved_path" in data and os.path.exists(data["saved_path"]):
            os.remove(data["saved_path"])


if __name__ == "__main__":
    unittest.main()
