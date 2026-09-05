# TGDetect REST API Contract

## Base URL
`http://localhost:8000/api`

## Content-Type
`application/json`

---

## Error Envelope
All error responses follow this standard schema with appropriate HTTP status codes (400, 404, 500):
```json
{
  "error": {
    "code": "ARTIFACT_NOT_FOUND",
    "message": "Artifact events.parquet was not found."
  }
}
```

---

## Endpoints

### 1. Health
* **GET** `/api/health`
  * Response:
    ```json
    {
      "status": "ok",
      "service": "tgdetect",
      "version": "1.0.0",
      "backend": "local"
    }
    ```

### 2. Overview
* **GET** `/api/overview`
  * Returns real aggregate pipeline statistics from `graph_stats.json`.
  * Response:
    ```json
    {
      "dataset": "mordor_empire",
      "total_events": 1219,
      "total_nodes": 26,
      "total_edges": 1219,
      "benign_events": 1200,
      "malicious_events": 19,
      "malicious_ratio": 0.0156,
      "chain_count": 3,
      "node_types": { "HOST": 5, "PROCESS": 8, "USER": 5, "IP": 8, ... },
      "relation_types": { "LOGON": 172, "EXECUTES": 180, ... },
      "source_tags": { "mordor_empire": 1219 },
      "tactics": { "execution": 3, "credential_access": 2, ... },
      "time_span_s": 86400.0,
      "pipeline_status": "ready"
    }
    ```

### 3. Events
* **GET** `/api/events`
  * Query parameters:
    * `search` / `event_id_query`: substring search on `event_id`
    * `label`: `0` (benign) or `1` (malicious)
    * `node_types`: comma-separated node types
    * `relations`: comma-separated relations
    * `source_tags`: comma-separated source tags
    * `tactics`: comma-separated tactics
    * `chain_id`: exact chain ID filter
    * `node_id`: events touching this node as source or destination
    * `limit`: integer (default 50, max 1000)
    * `offset`: integer (default 0)
  * Response:
    ```json
    {
      "items": [
        {
          "event_id": "evt-mal-c1-000",
          "ts": 1700003600.0,
          "src_id": "host:WKSTN-01.corp",
          "src_type": "HOST",
          "dst_id": "process:powershell.exe",
          "dst_type": "PROCESS",
          "relation": "EXECUTES",
          "label": 1,
          "tactics": ["execution"],
          "apt_stage": "execution",
          "source_tag": "mordor_empire",
          "chain_id": "chain_empire_01",
          "causal_parent": null,
          "attrs": { "command": "..." }
        }
      ],
      "total": 19
    }
    ```

* **GET** `/api/events/{event_id}`
  * Response: single `TGEvent` object or 404.

* **GET** `/api/events/recent-malicious`
  * Query parameters:
    * `limit`: integer (default 10)
  * Response: array of `TGEvent` objects where `label == 1`.

### 4. Graph
* **GET** `/api/graph`
  * Query parameters:
    * `malicious_only`: boolean (default false)
    * `node_type`: string filter
    * `relation`: string filter
    * `chain_id`: string filter
    * `limit`: integer (default 1000)
  * Response:
    ```json
    {
      "nodes": [
        {
          "node_id": "host:WKSTN-01.corp",
          "node_type": "HOST",
          "first_seen_ts": 1700000000.0,
          "last_seen_ts": 1700086400.0,
          "out_degree": 42,
          "in_degree": 15,
          "malicious_events": 2
        }
      ],
      "edges": [
        {
          "event_id": "evt-001",
          "src_id": "host:WKSTN-01.corp",
          "dst_id": "process:powershell.exe",
          "relation": "EXECUTES",
          "ts": 1700003600.0,
          "label": 1,
          "chain_id": "chain_empire_01",
          "causal_parent": null,
          "source_tag": "mordor_empire"
        }
      ],
      "stats": { /* GraphStats object */ }
    }
    ```

* **GET** `/api/graph/nodes/{node_id}`
  * Returns detailed node profile and incident events.

* **GET** `/api/graph/stats`
  * Returns `GraphStats` (parsed from `graph_stats.json`).

### 5. Attack Chains
* **GET** `/api/chains`
  * Query parameters:
    * `strategy`: `chain_id` | `causal_parent` | `entity_time`
  * Response: array of `AttackChainSummary` objects from `chains_summary.parquet`.
    ```json
    [
      {
        "chain_id": "chain_empire_01",
        "strategy": "chain_id",
        "num_events": 8,
        "num_nodes": 6,
        "start_ts": 1700003600.0,
        "end_ts": 1700003850.0,
        "duration_s": 250.0,
        "tactic_sequence": ["execution", "command_and_control", "persistence", "credential_access", "lateral_movement", "collection", "exfiltration"],
        "stage_sequence": ["execution", "command_and_control", ...],
        "relation_sequence": ["EXECUTES", "CONNECTS_TO", ...],
        "nodes": ["host:WKSTN-01.corp", "process:powershell.exe", ...],
        "event_ids": ["evt-mal-c1-000", ...]
      }
    ]
    ```

* **GET** `/api/chains/{chain_id}`
  * Response: single `AttackChainSummary` object or 404.

* **GET** `/api/chains/{chain_id}/subgraph`
  * Response: subgraphs parsed from `data/graphs/chains/{chain_id}.json`.
    ```json
    {
      "chain_id": "chain_empire_01",
      "strategy": "chain_id",
      "nodes": [ { "id": "host:WKSTN-01.corp", "node_type": "HOST" } ],
      "edges": [ { "event_id": "...", "src_id": "...", "dst_id": "...", "relation": "...", "tactics": [...] } ]
    }
    ```

* **GET** `/api/chains/{chain_id}/events`
  * Response: array of `TGEvent` objects belonging to this chain.

### 6. Datasets & Jobs
* **GET** `/api/datasets`
  * Returns list of available datasets from filesystem.
* **GET** `/api/datasets/{dataset_id}`
  * Returns dataset metadata.
* **GET** `/api/jobs`
  * Returns list of processing jobs that produced the artifacts.
* **GET** `/api/jobs/{job_id}`
  * Returns specific processing job details.

### 7. Artifacts
* **GET** `/api/artifacts`
  * Query parameters: `job_id`
  * Response: list of discovered artifacts (`events.parquet`, `edges.parquet`, `nodes.parquet`, `chains_summary.parquet`, `graph_stats.json`, etc.).
* **GET** `/api/artifacts/{artifact_id}/schema`
  * Returns column schemas with types, nullable indicators.
* **GET** `/api/artifacts/{artifact_id}/preview`
  * Query parameters: `limit` (default 10)
  * Returns preview rows as typed JSON array.

### 8. Model (TGNN)
* **GET** `/api/model/config`
  * Returns real `TemporalGNN` architecture hyperparameters:
    * `in_channels`: 10
    * `edge_dim`: 15
    * `hidden_channels`: 64
    * `out_channels`: 64
    * `num_gnn_layers`: 2
    * `num_rnn_layers`: 1
    * `dropout`: 0.3
    * `model_type`: "SAGEConv + GRU"
* **GET** `/api/model/summary`
  * Returns exact parameter counts and layer topology dynamically inspected from `best_model.pt`:
    * `total_parameters`: 36098 (actual model parameters: weights + biases)
    * `trainable_parameters`: 36098 (all weights and biases are trainable)
    * `non_trainable_parameters`: 0 (excluding BatchNorm buffers)
    * `bn_running_stats`: 258 (BatchNorm running-stat buffers: running_mean, running_var, num_batches_tracked; not model parameters)
    * `total_state_dict_elements`: 36356 (36098 parameters + 258 non-parameter buffers)
* **GET** `/api/model/snapshots`
  * Returns snapshot metadata from `meta.json` and individual snapshots.
* **GET** `/api/model/training`
  * Returns real training run history from `models/checkpoints/mordor_mixed/history.json`.
* **GET** `/api/model/evaluation`
  * Query parameters: `split` (`train` | `val` | `test`)
  * Returns real evaluation metrics from `eval/metrics_test.json`.
* **GET** `/api/model/predictions`
  * Query parameters: `split` (`train` | `val` | `test`), `limit`, `offset`
  * Returns sample prediction rows from `eval/predictions_test.parquet`.

### 9. Analytics
* **GET** `/api/analytics/events`
  * Time-series event buckets, tactic breakdown, source tag counts.
* **GET** `/api/analytics/graph`
  * Node type distribution, relation breakdown, degree distribution.
* **GET** `/api/analytics/attacks`
  * Strategy breakdown, chain length and duration histograms.
* **GET** `/api/analytics/datasets`
  * Normalization accepted/rejected, labeling indicator hits.
