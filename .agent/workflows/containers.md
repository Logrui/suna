---
description: List Suna Docker containers.
---

## User Input

```text
$ARGUMENTS
```

## Goal

Execute the `docker-list-containers.ps1` script to list containers.

## Arguments

- **-All** (optional switch): Include stopped containers in the list.

## Examples

- `/containers`: List running Suna containers.
- `/containers -All`: List all Suna containers (including stopped ones).

## Execution Steps

### 1. Run Script

```powershell
.\.scripts\core\docker-list-containers.ps1 $ARGUMENTS
```
