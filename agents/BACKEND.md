# Backend Architecture

Every backend domain lives in `packages/server/src/<domain>` and follows this layout:

```txt
<domain>/
├── <domain>.schema.ts
├── dto/
│   ├── <domain>.dto.ts
│   └── <domain>.filters.dto.ts
├── <domain>.repository.ts
├── <domain>.service.ts
├── <domain>.serializer.ts
├── <domain>-access.policy.ts
├── use-cases/
│   └── <domain>-workflow.use-case.ts
├── tests/
│   └── <domain>.test.ts
└── <domain>.controller.ts
```

These files are stubs until the product behavior is implemented.
