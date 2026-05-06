# Digital twin seed data

Used by the Integration Agent to host stateful enterprise replicas (helpdesk,
CRM, etc.) during agent evaluation. MindsDB-backed when available; falls
back to in-memory.

To export seed tickets to JSONL for MindsDB import:

```python
from pathlib import Path
from digital_twins.helpdesk_twin import export_seed_to_jsonl
n = export_seed_to_jsonl(Path("digital_twins/seed_data/helpdesk_tickets.jsonl"))
print(f"wrote {n} tickets")
```

Then in MindsDB:

```sql
CREATE PROJECT agentready_helpdesk;
USE agentready_helpdesk;
CREATE TABLE tickets FROM FILE 'helpdesk_tickets.jsonl' (
  format = 'jsonl'
);
```
