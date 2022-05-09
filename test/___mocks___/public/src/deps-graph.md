# Circular

```mermaid
flowchart LR
  circular --> dep1 --> dep2
  dep2 --> circular
```

# Circular 2

```mermaid
flowchart LR
  1[dep 1]-->2[dep 2]
  2 --> 3[dep 3]
  3 --> 2
```

# Circular 3

```mermaid
flowchart LR
  1[dep 1]-->2[dep 2]
  2 --> 3[dep 3]
  3 --> 2
  2 --> 4[dep 4]
  4 --> 2
  4 --> 5[dep 5]
  5 --> 1
```

# Circular 4

```mermaid
flowchart LR
  1[dep 1]-->2[dep 2]
  2 --> 3[dep 3] & 4[dep 4]
  3 --> 2
  4 --> 2 & 5[dep 5]
  5 --> 3
```

# Circular 5

```mermaid
flowchart LR
  D[Dropdown] --> T[Typings]
  D --> P[Popover] --> PL[PortalLayer]
  D --> UDV[useDelayValueUpdate]
  D --> UOCO[useOnClickOutside]
  UDV --> useTimout --> T
```

# Simple Caching

```mermaid
flowchart LR
  Dep1 --> Dep2 & Dep4
  Dep2 --> Dep3
  Dep4 --> Dep2
```

# Simple Caching 2

```mermaid
flowchart LR
  Dep1 --> Dep2 --> Dep3
  Dep1 --> Dep4 --> Dep5
```
