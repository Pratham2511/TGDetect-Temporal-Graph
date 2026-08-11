---
Task ID: 1
Agent: Main Agent
Task: Update TGDetect Frontend Demo - Remove Arch/Methodology, Add Datasets & Profiles

Work Log:
- Read scientific_evaluation_report.md and Architecture Analysis.md from teammate
- Updated synthetic data to reflect V16_Apex architecture (DARPA/UNSW/LANL datasets, MITRE ATT&CK tactics)
- Updated model metrics to match scientific report (V16 Apex F1=0.989 vs Pomsathit F1=0.330)
- Removed Architecture and Methodology pages from navigation
- Added Datasets page with:
  - Upload banner with drag-and-drop zone
  - 12 supported log formats (CSV, JSON, JSONL, Syslog, NetFlow, Wazuh, Zeek, Apache, Windows EVT, CEF, PCAP, Suricata)
  - Loaded datasets table with format, size, events, source, status columns
  - Upload modal with drag-and-drop and format grid
- Added Profiles page with:
  - Profile cards showing dataset, config (temporal window, heads, layers, memory, embed, threshold)
  - Active profile indicator in sidebar
  - Create Profile modal with name, description, dataset type, default V16 Apex config
  - Set Active / Delete actions per profile
- Fixed all tooltip formatters to avoid NaN display
- Updated detection table to show MITRE ATT&CK tactics
- Verified all 4 pages with Agent Browser - zero errors, clean rendering

Stage Summary:
- Interface now has 4 pages: Dashboard, Analytics, Datasets, Profiles
- All data reflects V16_Apex architecture from scientific report
- Upload supports 12 popular log formats
- Profile system with create/delete/activate functionality
- No NaN or "N" display issues found in charts
