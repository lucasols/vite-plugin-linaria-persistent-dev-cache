```mermaid
flowchart LR
  1[dep 1]-->2[dep 2]
  2 --> 3[dep 3]
  3 --> 2
  2 --> 4[dep 4]
  4 --> 2
  4 --> 5[dep 5]
  5 --> 3
```
