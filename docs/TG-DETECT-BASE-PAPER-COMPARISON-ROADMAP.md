# TG-Detect: Base-Paper Comparison and Major-Project Roadmap

Date: 2026-09-05

This report compares the as-built TG-Detect repository with the supplied paper:

Adaptive Detection of Advanced Persistent Threats (APT) With Graph Neural
Networks and Rehearsal-Based Continual Learning on Wazuh EDR Telemetry,
IEEE Access, 2025, DOI 10.1109/ACCESS.2025.3639270.

The repository architecture source is TG-DETECT-ARCHITECTURE-v1.md, audited
against commit 88fa442. The PDF and the repository are the only sources used
for the comparison. Raw captures are not present in the repository, and the
Python ML dependencies are not installed in the current environment. Therefore
this document distinguishes:

- reported paper results: numbers and claims printed in the PDF;
- repository evidence: behavior visible in source code and checked-in
  artifacts; and
- proposed work: changes required for a defensible major-project result.

The paper's 0.981 F1 is a useful reference point, but it is not an independently
reproducible benchmark from the supplied materials. A claim that TG-Detect
beats it should only be made after a matched data protocol, leakage audit,
multiple seeds, and uncertainty reporting.

## 1. Executive Verdict

TG-Detect currently contains a good graph-construction foundation, not an
implementation of the paper's proposed continual-learning detector.

The Python path already provides:

- streaming parsing of synthetic JSONL and Mordor/Security-Datasets logs;
- a typed, directed, temporal, multi-relational event graph;
- canonical entity IDs and timestamp normalization;
- optional heuristic labels and attack-chain reconstruction;
- Parquet event, edge, node, chain, and statistics outputs;
- sliding temporal snapshots; and
- a GraphSAGE plus GRU supervised prototype.

The following paper-defining components are absent or materially different:

- no native Wazuh ingestion path;
- no attention-based GNN;
- no rehearsal buffer or continual-learning update;
- no current-plus-replay loss;
- no reservoir-sampling implementation;
- no paper-style baselines;
- no five-seed aggregate experiment;
- no published-style latency or memory measurement;
- no leakage-free campaign-level benchmark; and
- no chain-level detection evaluation.

The strongest thesis direction is therefore:

> Build a leakage-free, relation-aware temporal graph detector with explicit
> rehearsal-based continual learning, then evaluate it on campaign-held-out and
> time-forward streams with event, node, and attack-chain metrics.

This direction uses the repository's existing strengths while addressing the
paper's omissions and the current prototype's validity problems.

## 2. What the Base Paper Reports

### 2.1 Pipeline

The paper describes four stages:

1. Collect benign Wazuh agent telemetry and sandbox-executed APT traces.
2. Convert endpoint entities and interactions into a graph G = (V, E, X).
3. Apply a multi-layer GNN for node-wise maliciousness classification.
4. Update the model continually with rehearsal of past samples.

The described telemetry includes process creation and termination, file
operations, registry access, and network connections. APT scenarios are mapped
to MITRE ATT&CK tactics.

### 2.2 Model and training configuration

The paper reports:

| Item | Paper configuration |
| --- | --- |
| GNN depth | 3 layers |
| Hidden width | 128 |
| Aggregation | Attention-based neighborhood aggregation |
| Activation | ReLU |
| Dropout | 0.2 |
| Output | Node-wise softmax classification |
| Optimizer | Adam |
| Learning rate | 1e-3 |
| Weight decay | 1e-5 |
| Batch size | 256 |
| Epochs | 200 per scenario |
| Replay buffer | 10% of past samples |
| Buffer update | Reservoir sampling |
| Continual loss | L_new(D_t) + lambda * L_rehearsal(D_buf) |
| Hardware | NVIDIA Tesla V100, 32 GB |
| Repetitions | 5 random seeds, mean plus/minus standard deviation |

The paper does not specify the attention layer type, number of attention
heads, exact feature encoding, value of lambda, task/scenario order, replay
sample format, threshold-selection procedure, or graph batching details.

### 2.3 Dataset reported in Table 1

| Dataset type | Graphs | Nodes | Edges | Malicious graph share | Source |
| --- | ---: | ---: | ---: | ---: | --- |
| Benign enterprise | 12,500 | 1.2M | 3.5M | 0% | Wazuh agents |
| APT sandbox | 8,300 | 0.9M | 2.7M | 100% | MITRE ATT&CK scenarios |

The paper calls the design balanced at the graph level. It does not give the
event-level or node-level class ratio, host count, campaign count, collection
duration, or split membership.

### 2.4 Baselines and reported results

The paper compares:

- CNN-BiLSTM with attention;
- static GNN;
- fine-tuned GNN without rehearsal; and
- generative replay IDS.

Table 4 reports the following aggregate values:

| Model | Precision | Recall | F1 | AUC | Latency (ms) | Memory overhead |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CNN-BiLSTM + attention | 0.935 plus/minus 0.002 | 0.928 plus/minus 0.003 | 0.931 plus/minus 0.002 | 0.94 | 2.4 | N/A |
| Static GNN | 0.961 plus/minus 0.003 | 0.949 plus/minus 0.004 | 0.955 plus/minus 0.003 | 0.96 | 4.1 | N/A |
| Fine-tuned GNN | 0.967 plus/minus 0.002 | 0.956 plus/minus 0.003 | 0.960 plus/minus 0.003 | 0.97 | 5.0 | N/A |
| Generative replay IDS | 0.976 plus/minus 0.003 | 0.963 plus/minus 0.004 | 0.969 plus/minus 0.003 | 0.97 | 8.2 | 12% |
| Proposed GNN plus rehearsal CL | 0.985 plus/minus 0.002 | 0.978 plus/minus 0.002 | 0.981 plus/minus 0.002 | 0.98 | 6.7 | 10% |

The paper states that the proposed method improves F1 by 2.1 percentage
points over fine-tuning and 5.0 points over CNN-BiLSTM. These are reported
claims, not values reproduced by this repository.

### 2.5 Ablation and tactic results

Table 5:

| Variant | Precision | Recall | F1 | AUC |
| --- | ---: | ---: | ---: | ---: |
| GNN only, no rehearsal | 0.963 | 0.951 | 0.957 | 0.969 |
| Sequential baseline plus rehearsal | 0.949 | 0.940 | 0.944 | 0.954 |
| Fine-tuned GNN, no buffer | 0.967 | 0.956 | 0.960 | 0.971 |
| Full GNN plus rehearsal CL | 0.985 | 0.978 | 0.981 | 0.988 |

Table 6:

| ATT&CK tactic | Precision | Recall | F1 |
| --- | ---: | ---: | ---: |
| Persistence | 0.994 | 0.990 | 0.992 |
| Privilege escalation | 0.986 | 0.982 | 0.984 |
| Command and control | 0.945 | 0.928 | 0.936 |

The paper identifies command and control, scale, and adversarial graph
perturbation as remaining weaknesses. Its future-work section proposes
federated continual learning, improved memory policies, adversarial robustness,
and an explainable interface.

## 3. Reproducibility Assessment of the Paper

The paper is useful as a conceptual base paper, but its method is
under-specified for exact reproduction. The following details are missing or
ambiguous:

1. Exact Wazuh decoder and field schema.
2. Which hosts, agents, malware samples, and campaigns were used.
3. How a raw record becomes a graph, including direction, self-loops, duplicate
   edges, and graph/window boundaries.
4. Whether labels are attached to events, edges, nodes, windows, or whole
   graphs.
5. The train, validation, and test split policy. In particular, campaign and
   host separation is not described.
6. The exact attention operator, head count, normalization, and parameter
   count.
7. Feature vocabulary and preprocessing for command lines, hashes, paths,
   registry keys, IPs, and ports.
8. Replay buffer item format and the value or schedule of lambda.
9. Reservoir-sampling seed, update frequency, and class/tactic balance.
10. Threshold selection and whether the reported F1 is threshold-tuned.
11. Latency measurement definition, batch size, warm-up, and hardware timing
    procedure.
12. Memory-overhead denominator and whether graph storage, optimizer state, or
    only the replay buffer is counted.
13. Raw per-seed results, confidence intervals, significance tests, calibration,
    false-positive rate, and alert-volume metrics.
14. Public code, data splits, and a run manifest.

There is also a potential shortcut in the dataset description: benign graphs
are 0% malicious and sandbox graphs are 100% malicious. If graph-level
membership, host identity, scenario artifacts, or collection conditions leak
into features, a random graph split can be much easier than a campaign-held-out
detector. The paper does not document controls for this possibility.

For the thesis, use 0.981 as a reported reference value. Do not present it as
an exact target that can be fairly compared until the data unit, label unit,
split, and threshold protocol are matched.

## 4. What TG-Detect Actually Implements

The as-built architecture is documented in
TG-DETECT-ARCHITECTURE-v1.md. Its end-to-end path is:

raw logs -> parser generators -> TGEvent -> normalization -> optional
heuristic labeling -> graph/node state and attack tracking -> Parquet ->
loaded graph -> sliding snapshots -> TemporalGNN -> checkpoints and reports.

### 4.1 Ingestion and graph layer

Implemented repository behavior:

- Synthetic JSONL and Mordor/Security-Datasets adapters.
- Plain, gzip, ZIP, and tar-family streaming readers.
- Typed nodes: USER, HOST, PROCESS, FILE, IP, DOMAIN, SOCKET, UNKNOWN.
- Fourteen relation values, including EXECUTES, CONNECTS_TO, LOGON, WRITES,
  AUTHENTICATES_TO, LATERAL_MOVE, EXFILTRATE, and GENERIC.
- Canonical type:value IDs.
- Epoch, millisecond, microsecond, Windows FILETIME, and ISO timestamp
  coercion.
- Streaming Parquet export with node aggregates.
- Three attack-chain grouping strategies: explicit chain ID, causal parent,
  and entity-time expansion.

The Mordor adapter fans Sysmon and Security records into typed edges. It is
not the same data source as Wazuh. The adapter also has a generic fallback for
unmapped records, which preserves volume but may reduce semantic precision.

### 4.2 Snapshot layer

The default snapshot configuration is a 60-second window with a 30-second
stride. Each snapshot locally re-indexes touched nodes and stores:

- node IDs and types;
- node feature matrix;
- directed edge index;
- one-hot relation plus relative-time edge features;
- edge labels;
- node labels; and
- a window label.

The default node feature matrix is type one-hot plus:

1. total degree;
2. out-degree;
3. in-degree; and
4. malicious-event ratio.

The last feature is label-derived. More importantly, the node table is built
from the complete graph before splitting, so its malicious count and degree
values can include future events and test information.

Node labels are assigned as 1 when a node touches any malicious edge in the
same snapshot. This is a useful diagnostic target, but it is not a causal
next-window target.

### 4.3 Current model

models/tgnn.py defines:

1. A stack of GraphSAGE SAGEConv layers per snapshot.
2. A linear edge encoder whose messages are mean-aggregated onto destination
   nodes.
3. Alignment of every snapshot to nodes in the final snapshot.
4. A GRU intended to aggregate the sequence.
5. A binary node classifier and a snapshot classifier.

The defaults are two GNN layers, hidden width 64, output width 64, and dropout
0.3. There is no attention-based GNN and no relation-specific message
parameterization beyond the shared edge linear layer.

### 4.4 Current training and evaluation

scripts/train_tgnn.py:

- loads all snapshots and sequences into memory;
- supports time and interleaved-block split helpers;
- uses AdamW, BCE with optional positive weighting, gradient clipping,
  ReduceLROnPlateau, early stopping, and validation threshold tuning;
- declares --batch-size but processes one sequence at a time;
- optimizes only final-snapshot node labels; and
- does not optimize the snapshot classifier.

scripts/evaluate_tgnn.py:

- always reconstructs a chronological split;
- does not reproduce block-mode training splits;
- writes node predictions and aggregate metrics; and
- leaves chain-level metrics as a placeholder because chain IDs are absent from
  snapshots and prediction rows.

The React/TanStack application is a disconnected presentation scaffold. It
does not read Parquet, call an inference service, or expose the model.

## 5. Side-by-Side Comparison

| Architecture concern | Base paper | Current TG-Detect | Assessment |
| --- | --- | --- | --- |
| Primary data | Wazuh EDR plus sandbox APT | Synthetic plus Mordor/Security-Datasets | Different; no direct data match |
| Raw telemetry | Process, file, registry, network | Sysmon/Security mappings; limited registry semantics and generic fallback | Partial |
| Graph | Entities and interactions | Directed typed temporal multi-relational graph | TG-Detect is more explicit |
| Node types | Processes, files, IPs, etc. | 8 typed categories | TG-Detect is stronger in schema |
| Relation types | Not enumerated in detail | 14 normalized relations | TG-Detect is stronger in schema |
| Time handling | Not specified | Event-driven sliding windows | TG-Detect is more explicit |
| Node features | Command lines, hashes, IPs stated | Type one-hot, global degrees, malicious ratio | Paper has richer intended semantics; current feature set leaks labels |
| Edge features | Not specified | Relation one-hot plus relative time | Partial implementation |
| GNN operator | 3-layer attention aggregation | 2-layer GraphSAGE plus edge linear messages | Material mismatch |
| Width/dropout | 128 / 0.2 | 64 / 0.3 by default | Material mismatch |
| Temporal module | Conceptually continual, no temporal GNN specified | GRU intended across snapshots | Partial, currently dimensionally misused |
| Continual learning | Rehearsal, 10% reservoir | None | Missing core contribution |
| Loss | New data plus replay loss | Final-node BCE only | Material mismatch |
| Outputs | Node classification described | Node and unused snapshot logits | Partial |
| Baselines | CNN-BiLSTM, static, fine-tune, generative replay | No complete comparison suite | Missing |
| Split protocol | Not documented | Helpers exist but training/evaluation disagree | Invalid until unified |
| Repetitions | 5 seeds, mean plus/minus SD | Mostly one seed/checkpoint | Missing |
| Class handling | Graph-level 0% or 100% descriptions | Mixed labels possible; single-class runs exist | Current benchmark is not controlled |
| Metrics | P/R/F1/AUC, latency, memory, tactic results | P/R/F1/AUC and confusion matrix; no latency/memory/chain | Partial |
| Explainability | Malicious subgraph visualization | Offline graph reports and chain JSON | Useful foundation, not model attribution |
| Serving | Claimed SOC/EDR applicability | No API or inference route | Missing |
| Scalability | Claimed replay overhead | Graph construction streams; loader/snapshots materialize | Partial |

The important conclusion is not that one system is simply better. The
repository is ahead in data contracts and temporal graph plumbing, while the
paper is ahead in the specific experimental claim of rehearsal-based
adaptation. The project should combine these strengths only after correctness
is fixed.

## 6. Current Evidence and Blocking Defects

### 6.1 Checked-in metrics are not a valid paper comparison

The checked-in artifacts show why a clean baseline is needed:

| Artifact | Observed result | Interpretation |
| --- | --- | --- |
| models/checkpoints/mordor_test/eval/metrics_test.json | 117 positives, 0 negatives; F1 and accuracy 1.0; AUC undefined | Single-class evaluation |
| models/checkpoints/mordor_full/history.json | Perfect validation values with undefined AUC | Single-class validation |
| models/checkpoints/mordor_mixed/eval/metrics_test.json | 19,218 negatives, 1,072 positives; all predictions positive; F1 0.1004; PR-AUC 0.2363 | Fixed-threshold behavior is unusable |
| results/mordor_mixed/.../test_metrics.json | Tuned threshold 0.9434; F1 0.7768; PR-AUC 0.8681; ROC-AUC 0.6697 | Different protocol/artifact, still below paper and not matched |
| results/mordor_mixed/.../eval_test/metrics_test.json | F1 0.7027; PR-AUC 0.6780 | Another split/output with materially different values |

These artifacts should be treated as debugging evidence, not a leaderboard.
The difference between the mixed outputs also indicates that the run
configuration, split, threshold, or checkpoint provenance is not captured
consistently enough for a scientific comparison.

### 6.2 Priority-zero correctness issues

1. **GRU dimension semantics.** The model creates a tensor shaped [time, nodes,
   hidden] but sets batch_first=True. PyTorch therefore interprets time as
   batch and nodes as sequence. The recurrent operation is across nodes for
   each time slice, not across time for each node. Fix this before evaluating
   any temporal claim.

2. **Target leakage.** malicious_events and malicious_ratio are computed from
   the full labeled graph and then supplied as node features. They encode the
   target directly, including future information relative to a prediction
   window. They must be removed or computed strictly from the historical
   prefix available at inference time.

3. **Same-window labels.** A node is labeled from an edge in the same snapshot
   whose features also contain that graph context. Define an explicit
   prediction horizon, for example history [t - H, t] predicts events or nodes
   in (t, t + Delta].

4. **Split inconsistency.** Training can use block splitting, while standalone
   evaluation always uses chronological splitting. A checkpoint must carry one
   split manifest that both paths consume.

5. **Overlapping-window leakage.** Adjacent sliding windows share events and
   nodes. Split by campaign/host and add a purge gap at least as large as the
   history window before reporting a generalization score.

6. **No real batching.** --batch-size is only a command-line declaration.
   Either implement a collator for variable-size graph sequences or remove the
   option and report the one-sequence optimization behavior.

7. **Unused objective.** The snapshot head is defined but not trained or
   reported. Add a weighted multi-task loss or remove the head.

8. **Missing chain context.** Snapshot and prediction records do not retain
   chain IDs, tactic IDs, or event IDs, so campaign detection, stage coverage,
   and time-to-first-alert cannot be measured.

9. **Weak-label contamination.** Heuristic labeling uses suspicious tools,
   command lines, event IDs, and relations that can also appear in model
   features. Keep parser/metadata labels as gold; evaluate heuristic labels as
   a noisy-label track with explicit coverage and confidence.

10. **Mordor default labels.** Without metadata or an explicit mode, Mordor
    parsing can default to label 1. Every run must record label provenance and
    reject ambiguous configurations.

11. **Memory boundary.** The graph builder streams, but load_graph,
    SnapshotBuilder, and training materialize large tables or all snapshots.
    This is acceptable for a prototype and not yet a scale claim.

## 7. Target Architecture

The proposed target keeps the existing ETL boundary and replaces the
invalid or absent ML pieces:

~~~text
Wazuh / Mordor / synthetic sources
        |
        v
versioned TGEvent schema + parser provenance + deduplication
        |
        v
typed temporal event graph
  (entity types, relation types, timestamps, ATT&CK labels)
        |
        v
train-only vocabularies/scalers + causal history windows
        |
        v
relation-aware heterogeneous temporal encoder
  (HGT or relation-aware GAT, time encoding, optional TGN memory)
        |
        +--> event/edge head
        +--> node head
        +--> chain/window head
        +--> ATT&CK tactic/stage head
        |
        v
continual update controller
  drift detector -> current loss + replay loss + distillation
        |
        v
calibration and alert policy
        |
        +--> offline metrics/reports
        +--> versioned inference API
        +--> analyst graph explanation
~~~

### 7.1 Representation

Use the current typed graph as the canonical representation, then add:

- process image, parent process, command-line token or hashed token features;
- file path/category and hash features;
- registry key/value features;
- destination IP/domain, port, protocol, and DNS features;
- user, host, process lineage, and agent identity embeddings;
- relation-specific direction and reverse-edge indicators;
- delta-time and absolute-time encodings such as Time2Vec;
- burst, rarity, and novelty features computed only from the historical prefix;
  and
- ATT&CK technique/tactic metadata as labels or auxiliary targets, never as
  future-leaking inputs.

Fit vocabularies, normalization statistics, and rarity thresholds on the
training partition only. Hash or tokenize sensitive values rather than
embedding raw secrets into artifacts.

### 7.2 Encoder

Implement one primary model and a small controlled ablation set:

- primary: relation-aware temporal attention model, preferably HGT or
  relation-aware GAT/GATv2 over typed nodes and edges;
- temporal option: TGN-style event memory or a corrected GRU/temporal
  Transformer over node histories;
- direction: retain directed edges and add explicit reverse relations where
  useful;
- depth/width for paper reproduction: 3 layers and width 128;
- regularization: ReLU or GELU, dropout 0.2, layer normalization, and
  gradient clipping; and
- heads: event/edge maliciousness, node maliciousness, window/chain
  maliciousness, and ATT&CK tactic or stage.

Do not add every advanced component at once. First establish a paper-style
attention baseline, then add temporal memory and auxiliary tasks one at a time.

### 7.3 Continual learner

At stream step t, optimize:

~~~text
L_t = L_current(D_t)
    + lambda_replay * L_replay(B_t)
    + lambda_distill * L_distill(B_t)
    + lambda_aux * L_tactic/stage
~~~

Start with the paper's 10% reservoir as the reproduction baseline. Then
compare:

- uniform reservoir;
- class-balanced reservoir;
- tactic-balanced reservoir;
- host/campaign-diverse reservoir;
- uncertainty and hard-negative priority;
- graph-context replay, which stores a small induced subgraph rather than an
  isolated edge; and
- replay plus lightweight weight distillation (DER++/LwF-style).

Sweep buffer sizes of 1%, 5%, 10%, and 20%. Record bytes, examples, graph
context, and update time. Use a drift detector such as ADWIN, Page-Hinkley,
or a distribution-distance test to trigger review/update, not blind continuous
retraining.

## 8. Phase-by-Phase Implementation Plan

The phases below are ordered so that every later accuracy claim rests on a
valid earlier measurement. A 14-16 week college project can complete the
must-have path; stretch items are explicitly marked.

### Phase 0: Freeze the research contract (Week 1)

Goal: define exactly what "better" means.

Tasks:

- Choose the primary prediction unit. Recommended: next-horizon event/node
  maliciousness. Keep chain/window detection as secondary outputs.
- Define history length H, prediction horizon Delta, window size, stride, and
  alert aggregation policy.
- Register four evaluation tracks:
  1. within-source diagnostic;
  2. campaign-held-out;
  3. chronological forward stream; and
  4. unseen-tactic or cross-source OOD.
- Declare primary metrics before training: PR-AUC and F1 at a threshold fixed
  on validation. Add recall at a fixed false-positive rate.
- Create a data card, threat model, privacy note, and experiment manifest
  format containing git commit, data hashes, parser version, label mode,
  feature mode, split IDs, seed, dependency versions, and hardware.

Exit gate:

- A written protocol can answer what one sample is, what information is
  available at prediction time, and which rows are held out.

### Phase 1: Build a trustworthy corpus and labels (Weeks 1-2)

Goal: obtain both classes and preserve campaign identity.

Tasks:

- Run the existing inspector on every capture.
- Add a Wazuh JSON adapter if Wazuh data is available. Preserve agent ID,
  host, process GUID, parent GUID, event ID, timestamp, command line, image,
  file, registry, network, and original record ID.
- Keep Mordor and synthetic sources as separate source-tagged tracks.
- Join ATT&CK metadata to events or scenarios with an auditable provenance
  field.
- Preserve campaign, host, source file, causal parent, event ID, tactic, and
  technique fields through Parquet and snapshots.
- Count malformed records, duplicate IDs, out-of-order timestamps, missing
  fields, and unknown entity types.
- Separate gold metadata labels from heuristic labels. Do not train on
  heuristic propagation as if it were ground truth.
- Construct benign background and malicious scenarios with explicit class
  ratios. Record event-, node-, window-, and chain-level ratios.

Exit gate:

- Every labeled event can be traced to a source record and label reason.
- Both train and test contain benign and malicious examples without mixing a
  campaign across partitions.

Likely files:

- graph_builder/parsers.py
- graph_builder/schema.py
- graph_builder/normalizer.py
- graph_builder/exporters.py
- scripts/inspect_dataset.py
- scripts/validate_graph.py

### Phase 2: Remove leakage and make the temporal target causal (Weeks 3-4)

Goal: establish a defensible baseline before model changes.

Tasks:

- Remove malicious_events and malicious_ratio from default evaluation features.
- Replace full-graph degree with prefix-only degree or lagged degree.
- Fit feature scalers and categorical maps on train only.
- Change snapshot generation to history/target pairs. Events in the target
  interval must not influence history features.
- Add a purge gap between train, validation, and test windows.
- Split by campaign and host, not only by row or overlapping window.
- Fix the GRU layout. Either pass [N, T, H] with batch_first=True or set
  batch_first=False and test that a synthetic temporal signal changes the
  output in the expected direction.
- Create one shared split/config module used by both training and evaluation.
- Implement true variable-size sequence batching, or remove the misleading
  batch-size argument.
- Add snapshot chain IDs, tactic IDs, and event IDs.
- Add unit tests for timestamp coercion, type inference, parser fan-out,
  label provenance, split purge, snapshot labels, and GRU shape semantics.

Exit gate:

- A label-shuffle test collapses to chance.
- A future-feature test detects and rejects leakage.
- A temporal toy test proves the recurrent dimension is time.
- Train and evaluation report identical split hashes.

Likely files:

- graph_builder/temporal.py
- models/tgnn.py
- scripts/train_tgnn.py
- scripts/evaluate_tgnn.py
- new tests/ and a shared experiment configuration module

### Phase 3: Reproduce the paper-style baselines (Weeks 5-6)

Goal: create an apples-to-apples reference suite.

Implement:

1. Rule-based and logistic/LightGBM sanity baselines.
2. Corrected current GraphSAGE model.
3. Paper-style static attention GNN: 3 layers, width 128, dropout 0.2.
4. Fine-tuned GNN with sequential updates and no replay.
5. Paper-style rehearsal GNN with a 10% reservoir.
6. CNN-BiLSTM with attention, using an explicitly defined event sequence.
7. Generative replay only if time and data permit; otherwise mark it as a
   planned comparison rather than claiming a complete reproduction.

Use the same data, feature budget, optimizer family, stopping rule, and
validation threshold policy across models. Run at least five seeds and save
per-seed metrics, not only means.

Exit gate:

- The paper-style model can be run from a single manifest.
- Results are reported separately for diagnostic, campaign-held-out, and
  time-forward tracks.
- Any difference from the paper is explained as a data/protocol mismatch
  rather than hidden by a tuned threshold.

### Phase 4: Add relation-aware temporal modeling (Weeks 7-9)

Goal: exploit the repository's typed temporal graph beyond the paper's generic
GNN.

Tasks:

- Add relation-specific projections or HGT/R-GAT attention.
- Add typed node embeddings and explicit relation embeddings.
- Add edge delta-time and absolute-time encodings.
- Compare corrected GRU, temporal Transformer, and TGN-style event memory.
- Preserve process-to-host-to-user-to-file-to-IP paths with direction.
- Add multi-task heads for event, node, window/chain, and tactic/stage labels.
- Use class-balanced BCE/focal or asymmetric loss only after the clean
  baseline is measured.
- Add hard benign negatives: common administrative tools, software updates,
  normal DNS, and routine authentication.

A practical primary model for a college project is:

~~~text
typed node/edge encoder
    -> 3 relation-aware attention layers (128)
    -> time encoding plus node memory
    -> corrected temporal aggregator
    -> event/node/window/tactic heads
~~~

Exit gate:

- The proposed model improves PR-AUC and fixed-FPR recall on the same held-out
  split, not merely threshold-tuned F1 on a new split.
- Ablation shows which of relation types, time encoding, and memory caused the
  gain.

### Phase 5: Implement and study rehearsal-based continual learning (Weeks 9-11)

Goal: directly implement the paper's central contribution and improve it.

Tasks:

- Define scenario or campaign arrival order as the continual stream.
- Implement a reservoir buffer with exact capacity accounting.
- Store graph context and labels needed to replay a valid message-passing
  neighborhood.
- Add current loss plus replay loss with a logged lambda.
- Establish static and fine-tuning controls.
- Compare uniform, class-balanced, tactic-balanced, diverse, and uncertain
  memory policies.
- Add optional distillation to preserve old logits or embeddings.
- Trigger updates on explicit task boundaries first; add drift detection as a
  separate experiment.
- Evaluate after every task, including old and new task performance.

Continual-learning metrics:

- average accuracy across tasks;
- final old-task accuracy;
- forgetting (maximum previous score minus final score);
- backward transfer;
- forward transfer;
- adaptation steps/time;
- new-threat recall; and
- buffer bytes and update latency.

Exit gate:

- Rehearsal reduces forgetting relative to fine-tuning on at least one
  campaign-held-out stream without unacceptable false-positive growth.
- The exact buffer contents and update order are reproducible from a seed.

### Phase 6: Improve data efficiency, imbalance handling, and OOD behavior
(Weeks 11-12)

Goal: improve robustness rather than optimize one aggregate score.

Tasks:

- Pretrain on unlabeled benign telemetry with masked relation prediction,
  temporal-order prediction, or graph contrastive learning.
- Tune focal/asymmetric/class-balanced losses against a fixed validation alert
  budget.
- Calibrate probabilities with temperature scaling or isotonic regression.
- Select one threshold on validation and freeze it for test.
- Add unseen campaign, unseen host, unseen tactic, and synthetic-to-Mordor
  transfer tests.
- Evaluate class-prior shift and missing-label conditions.

Exit gate:

- The model retains useful PR-AUC and recall under at least one OOD track.
- Calibration error and alert volume are reported alongside F1.

### Phase 7: C2, noise, adversarial robustness, and explanations (Weeks 12-13)

Goal: address the paper's stated weaknesses.

Tasks:

- Create a C2-specific slice for low-volume, encrypted, and beacon-like
  connections. Report precision, recall, F1, and lead time separately.
- Inject realistic missing, delayed, duplicated, and out-of-order records.
- Test graph perturbations: edge deletion, benign edge insertion, node
  spoofing, and relation corruption.
- Compare robustness training with edge dropout, feature masking, and
  adversarial perturbation.
- Produce top-k explanatory subgraphs using attention weights, Integrated
  Gradients, PGExplainer, or GNNExplainer.
- Score explanation fidelity and sparsity instead of showing only a picture.

Exit gate:

- C2 performance and robustness degradation are quantified.
- Every reported alert can expose the contributing entities, relations,
  timestamps, and ATT&CK mapping.

### Phase 8: Operational demonstration and final study (Weeks 13-16)

Goal: turn the research result into a credible major-project system.

Tasks:

- Add a versioned inference entry point or FastAPI service over artifacts.
- Stream new events into a bounded graph/state store.
- Add model, schema, feature, and replay-buffer compatibility checks.
- Measure p50/p95 latency, throughput, peak RAM/VRAM, update time, and storage.
- Connect the existing React scaffold only after the offline API contract is
  stable. Show alerts, chain timelines, graph context, explanations, and
  model/version metadata.
- Run the final five-seed experiment and bootstrap confidence intervals.
- Archive manifests, per-seed checkpoints, predictions, metrics, plots, and
  environment details.

Exit gate:

- A fresh environment can rebuild the reported result from the manifest.
- The final report contains a complete error analysis and limitations section.

## 9. Experimental Matrix

### 9.1 Models

| ID | Model | Purpose |
| --- | --- | --- |
| B0 | Rules / logistic / LightGBM | Sanity and feature-leakage check |
| B1 | Corrected GraphSAGE | Current architecture baseline |
| B2 | Paper-style 3x128 attention GNN | Direct architecture reference |
| B3 | Static GNN | No-updates control |
| B4 | Fine-tuned GNN | Continual adaptation without memory |
| B5 | GNN plus 10% reservoir replay | Paper-style reproduction |
| P1 | Relation-aware temporal GNN | Proposed representation gain |
| P2 | P1 plus balanced graph replay | Proposed continual-learning gain |
| P3 | P2 plus self-supervised pretraining | Stretch data-efficiency gain |

### 9.2 Splits

Report each split separately; never replace a hard split with an easier one.

1. Within-source random split: diagnostic only.
2. Campaign-held-out split: no campaign appears in more than one partition.
3. Host-held-out split: tests entity generalization.
4. Chronological forward split: train on past, test on future.
5. Unseen-tactic split: hold out one or more ATT&CK tactics.
6. Cross-source split: train on synthetic/Mordor, test on Wazuh-like data when
   available.

### 9.3 Metrics

Primary detection metrics:

- PR-AUC, because benign events dominate operational telemetry;
- F1 at a validation-fixed threshold;
- precision, recall, ROC-AUC, MCC, and balanced accuracy;
- recall at fixed false-positive rates;
- false alerts per hour or day; and
- event-, node-, edge-, window-, and chain-level scores.

Temporal and continual metrics:

- time to first alert;
- attack lead time;
- chain detection rate;
- ATT&CK stage coverage;
- average continual accuracy;
- forgetting, backward transfer, and adaptation time.

Operational and trust metrics:

- p50 and p95 inference latency;
- throughput in events per second;
- peak RAM and VRAM;
- replay-buffer bytes;
- model size and update time;
- expected calibration error and Brier score; and
- explanation fidelity and sparsity.

Use five independent seeds where resources permit. Report mean, standard
deviation, and 95% bootstrap confidence intervals. For paired model claims,
use a paired bootstrap or a suitable significance test over campaigns, not
only over individual correlated events.

## 10. Definition of a Defensible Win

There are two different claims, and they must not be conflated.

### Matched-paper claim

On a matched Wazuh-plus-sandbox dataset and a documented equivalent split, the
proposed model must exceed the paper's reported F1 of 0.981 with overlapping
protocol definitions, preferably with a confidence interval that supports the
difference.

### Stronger-science claim

If the paper data cannot be obtained, report that direct reproduction is
impossible and demonstrate:

- higher PR-AUC and F1 at a fixed false-positive budget than the implemented
  baselines;
- higher recall on held-out campaigns, hosts, or tactics;
- lower continual-learning forgetting than static and fine-tuned controls;
- C2 F1 above the paper's reported 0.936 on a comparable C2 slice;
- calibrated probabilities and lower alert volume; and
- acceptable p95 latency and memory.

This is a stronger and more honest result than comparing a tuned score from
one repository run with an aggregate number from a different dataset.

## 11. Repository Work Breakdown

Suggested additions, in implementation order:

| Area | Work |
| --- | --- |
| graph_builder/temporal.py | Causal history/target windows, train-only features, chain/tactic propagation |
| graph_builder/schema.py | Versioned provenance, target horizon, technique and host/campaign IDs |
| graph_builder/parsers.py | Wazuh adapter, explicit parse-error counters, richer registry/network fields |
| scripts/split.py | Shared campaign/host/time split and purge-gap logic |
| scripts/train_tgnn.py | Real batching, deterministic manifests, multi-task loss, replay loop |
| scripts/evaluate_tgnn.py | Shared split loading, chain metrics, calibration, alert-rate metrics |
| models/tgnn.py | GRU fix, relation-aware attention, temporal memory, auxiliary heads |
| models/replay.py | Reservoir and balanced/diverse graph-context buffers |
| models/metrics.py | Detection, OOD, continual, latency, calibration, and explanation metrics |
| scripts/run_experiment.py | One-command multi-seed matrix and artifact registry |
| tests/ | Parser, schema, leakage, split, snapshot, replay, and model-shape tests |
| service/ or API module | Optional inference boundary after offline validity is established |

Do not make the React scaffold the first milestone. It currently has no model
or artifact API to consume; UI work should follow the validated serving
contract.

## 12. Risks and Controls

| Risk | Control |
| --- | --- |
| Paper result cannot be reproduced | State the limitation; use matched protocol or label result as non-comparable |
| Label leakage inflates score | Prefix-only features, purge gaps, label-shuffle tests |
| Heuristic labels look like ground truth | Separate gold and weak-label tracks |
| Random graph split memorizes campaigns | Campaign/host/time group splits |
| Replay stores invalid isolated nodes | Store induced graph context and provenance |
| C2 remains weak | Dedicated C2 slice, hard negatives, time-aware network features |
| Large telemetry exceeds RAM | Parquet streaming, bounded snapshots, sampled neighborhoods |
| Sensitive telemetry leaks | Hash/tokenize secrets, restrict artifacts, safe deserialization |
| Too many model ideas for a college schedule | One primary model plus pre-registered ablations |
| Frontend distracts from research | Defer UI until API and metrics are stable |

## 13. Immediate Next Actions

The first implementation sprint should be:

1. Add a shared experiment manifest and campaign/host/time split utility.
2. Remove malicious-event features from the clean baseline.
3. Fix and unit-test GRU time semantics.
4. Change labels to a causal next-window target.
5. Preserve chain, tactic, source-record, and provenance fields in snapshots.
6. Produce a mixed benign/malicious benchmark with no single-class partitions.
7. Re-run corrected GraphSAGE and a 3-layer, 128-wide attention baseline.
8. Save per-seed predictions and PR-AUC/F1/alert-rate reports.
9. Only then implement the 10% reservoir replay loop.

The project is ready to start research immediately, but the first scientific
milestone is validity, not a larger network. Once the corrected baseline is
stable, the relation-aware temporal encoder and replay policy can be evaluated
as genuine improvements.

## 14. Evidence Index

Repository architecture and limitations:

- TG-DETECT-ARCHITECTURE-v1.md, especially sections 1, 3, 5, 6, 9, and 12.
- graph_builder/schema.py
- graph_builder/parsers.py
- graph_builder/temporal.py
- models/tgnn.py
- scripts/train_tgnn.py
- scripts/evaluate_tgnn.py
- models/checkpoints/mordor_test/eval/metrics_test.json
- models/checkpoints/mordor_mixed/eval/metrics_test.json
- results/mordor_mixed/checkpoints/mordor_mixed/test_metrics.json

Base paper:

- Adaptive_Detection_of_Advanced_Persistent_Threats_APT_With_Graph_Neural_Networks_and_Rehearsal-Based_Continual_Learning_on_Wazuh_EDR_Telemetry (1).pdf
- Tables 1, 4, 5, 6, and 7; Sections III-G through V.
