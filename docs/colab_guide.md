# Google Colab Remote Execution Guide

This project is configured to offload heavy workloads (installations, testing, Next.js builds) to **Google Colab**, preserving local memory on low-RAM servers (e.g. 1 GB RAM environments).

---

## 🛠️ Colab Helper Scripts

All helper scripts are located in `scripts/`:

| Script | Purpose |
| :--- | :--- |
| `scripts/colab_exec.sh` | Run any command remotely on Colab VM with output streamed live |
| `scripts/colab_sync.sh` | Fast-sync local workspace changes to `/content/egg` on Colab |
| `scripts/colab_manage.sh` | Start, stop, check status, or get web UI URL for the Colab VM |

---

## 🚀 Common Commands

### 1. Execute Remote Commands
Use `colab_exec.sh` to run commands inside `/content/egg` on the Colab VM:

```bash
# Run backend pytest
./scripts/colab_exec.sh pytest backend/tests

# Run backend test seed script
./scripts/colab_exec.sh python3 backend/test_seed.py

# Run Next.js lint / build
./scripts/colab_exec.sh npm --prefix frontend run build
```

### 2. Auto-Sync Before Executing
If you made local file changes and want to sync before running:
```bash
./scripts/colab_exec.sh --sync pytest backend/tests
```

### 3. Manual Sync
```bash
./scripts/colab_sync.sh
```

### 4. Manage VM Session
```bash
# Check status of the remote VM
./scripts/colab_manage.sh status

# Open browser URL to inspect live in Colab web UI
./scripts/colab_manage.sh url

# Stop VM when finished working (saves compute quota)
./scripts/colab_manage.sh stop

# Start VM again when needed
./scripts/colab_manage.sh start
```
