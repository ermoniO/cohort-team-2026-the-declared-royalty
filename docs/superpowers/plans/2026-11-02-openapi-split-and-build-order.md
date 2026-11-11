# OpenAPI Build Order Fix, Multi-File Spec Split, and Mono-Repo Docker Build: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `./mvnw compile` always generate the OpenAPI Java sources before compiling; split `backend/openapi.yaml` into a multi-file spec under `backend/src/main/resources/openapi/` that generates byte-identical Java; and make local, CI and Docker builds use the same pinned toolchain so the whole mono-repo builds with `docker compose`.

**Architecture:** Set up JDK 21 and the Maven wrapper first (Task 0), so every later task is verified with a clean build. Fix the Maven lifecycle wiring (Task 1). Then move and split the spec with standard `$ref` file references and prove the generated output is unchanged (Task 2). Then make Docker use `./mvnw` (Task 3), add the frontend image to the compose build (Task 4), and update docs and guidelines (Task 5).

**Tech Stack:** Java 21 (`.sdkmanrc`: `java=21.0.6-tem`), Spring Boot 4.1.1, Maven wrapper (`distributionUrl` = Maven 3.10.0), `openapi-generator-maven-plugin` 7.8.0 (generator `spring`, `interfaceOnly`), OpenAPI 3.0.3, Docker Compose, Node (frontend, Vite).

**Spec:** the user requests in this conversation (no separate design doc), plus `.agents/rules/project-guidelines.md` ("Contract-first workflow").

## Global Constraints

- Spec version stays `openapi: 3.0.3`.
- `apiPackage` = `org.dsd.cohort2026fall.tdr.invoiceautomationservice.api`, `modelPackage` = `org.dsd.cohort2026fall.tdr.invoiceautomationservice.model` (unchanged).
- Generator options stay exactly as in `backend/pom.xml` today (`interfaceOnly`, `useTags`, `useSpringBoot3`, `useJakartaEe`, `openApiNullable=false`, `skipDefaultInterface`, `unhandledException`).
- Generated output stays under `backend/target/generated-sources/openapi`. Never commit or hand-edit generated code.
- New spec location: `backend/src/main/resources/openapi/openapi.yaml` (root), with `paths/` and `components/` beside it.
- No change to any endpoint path, operationId (12 in total), tag, schema name (11) or schema content. The split is a pure refactor.
- Hand-written controllers (`PropertyController`, `UserController`, `VendorController`) must compile unchanged.
- **One Maven for every environment:** the wrapper (`backend/.mvnw`, Maven 3.10.0) is the only Maven used locally, in CI and in Docker. No `mvn` from the PATH or from a `maven:*` image.
- Keep existing comments in `pom.xml`, `compose.yaml` and the guidelines that are unrelated to the change.

## Review Focus

1. **Relative `$ref` resolution:** path-item refs with `{propertyId}` in the file name must resolve in the generator. Expect: the build resolves them or fails loudly; operations are never silently dropped.
2. **Silent loss of operations or schemas in the split:** the generated `*Api` and `model` file list after the split must equal the baseline.
3. **Stale generated sources:** a `./mvnw compile` after deleting a schema must not leave an orphan class that hides a broken reference. Always verify with `clean`.
4. **Docker build context:** the backend image must build from a clean clone with only `pom.xml`, `mvnw`, `.mvn/` and `src/` (the spec is under `src/`, so it travels with the `COPY src`). No stray `target/` or `node_modules` in any build context.
5. **Case-only rename on macOS:** `dockerfile` to `Dockerfile` is invisible on a case-insensitive filesystem. Git must record the rename, or Linux CI and `compose.yaml` (`dockerfile: Dockerfile`) still break.
6. **Fresh clone, no `target/`:** `./mvnw clean compile` must work from nothing (this is the reported bug scenario).

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/pom.xml` (modify) | Bind OpenAPI generation to `generate-sources`; register the generated folder as a source root; point `inputSpec` at the new location. |
| `backend/openapi.yaml` (move, shrink) | Moves to `backend/src/main/resources/openapi/openapi.yaml`; becomes the root document only: `info`, `servers`, `paths` (one `$ref` per path), `components` (one `$ref` per item). |
| `backend/src/main/resources/openapi/paths/*.yaml` (create) | One file per path item: `properties.yaml`, `properties_{propertyId}.yaml`, `users.yaml`, `users_{userId}.yaml`, `vendors.yaml`, `vendors_{vendorUuid}.yaml`. |
| `backend/src/main/resources/openapi/components/schemas/*.yaml` (create) | One file per schema, named exactly as the schema. |
| `backend/src/main/resources/openapi/components/parameters/VendorUuid.yaml` (create) | The shared `VendorUuid` parameter. |
| `backend/src/test/java/.../OpenApiSpecStructureTest.java` (create) | Guards the split: root is small, and every `$ref` resolves to an existing file. |
| `backend/dockerfile` → `backend/Dockerfile` (rename, modify) | JDK-only build stage that runs `./mvnw`; fixes the Maven version mismatch. |
| `backend/.dockerignore` (create) | Keeps `target/` and IDE files out of the build context. |
| `frontend/Dockerfile` (add to git, minor edit) | Frontend image for the mono-repo build (currently untracked). |
| `frontend/.dockerignore` (create) | Keeps `node_modules/` and `dist/` out of the build context. |
| `compose.yaml` (modify) | Add a `frontend` service built from `frontend/Dockerfile`. |
| `.agents/rules/project-guidelines.md` (modify, lines 69 and 75) | Describe the split spec and its real location. |
| `README.MD` (modify) | Fix the tree, the "API Contract & Code Generation" section, and the Java version. |

**Answer to "does `./mvnw` in the Dockerfile fix the Maven mismatch?"** Yes. Today the repo has three Mavens: the wrapper (3.10.0, used locally and in CI), the Docker image (`maven:4.0.0-rc-7`, a release candidate of a different major version) and any system `mvn`. Running `./mvnw` in the Dockerfile makes the wrapper's `distributionUrl` the only definition, so Docker gets 3.10.0 too. The base image must change to a JDK-only image (`eclipse-temurin:21-jdk`), or the `maven:*` image's Maven would still sit unused on the PATH and confuse the next reader. The `.mvn/wrapper` folder and `mvnw` must be copied into the build stage. The JDK still differs at patch level (image `21` versus `.sdkmanrc` `21.0.6`), which is acceptable.

---

### Task 0: Set up JDK 21 and the Maven wrapper

**Files:** none changed; this prepares the machine.

**Interfaces:**
- Produces: `cd backend && ./mvnw -v` printing `Apache Maven 3.10.0` and `Java version: 21.0.6`. Every later task relies on it.

- [ ] **Step 1: Check what exists.** Run `java -version`, `echo $JAVA_HOME`, `ls ~/.sdkman`. Expected on this machine: no JDK and no SDKMAN.
- [ ] **Step 2: Install SDKMAN.** Run `curl -s "https://get.sdkman.io" | bash`, then `source ~/.sdkman/bin/sdkman-init.sh`. Needs network access (user approval). Expected: `sdk version` prints a version.
- [ ] **Step 3: Install the pinned JDK.** From the repo root run `sdk env install`. It reads `.sdkmanrc`. Expected: `java -version` shows Temurin `21.0.6`.
- [ ] **Step 4: Make it automatic.** Set `sdkman_auto_env=true` in `~/.sdkman/etc/config`. In the IDE set the project SDK to the SDKMAN `21.0.6-tem` directory.
- [ ] **Step 5: Verify the wrapper.** Run `cd backend && ./mvnw -v`. The first run downloads Maven 3.10.0 (needs network, and `curl` or `wget` because the wrapper is `only-script`). Expected: `Apache Maven 3.10.0`, `Java version: 21.0.6`.
- [ ] **Step 6: Warm the dependency cache.** Run `./mvnw -B dependency:go-offline`. Expected: `BUILD SUCCESS`.
- [ ] **Step 7: Check Docker.** Run `docker --version` and `docker compose version`. Tasks 3 and 4 need them.

No commit (nothing changes in the repo).

---

### Task 1: Fix build order so `./mvnw compile` generates sources first

**Files:**
- Modify: `backend/pom.xml` (the `openapi-generator-maven-plugin` and `maven-compiler-plugin` blocks)
- Create (scratch, not committed): `/tmp/openapi-baseline.txt`

**Interfaces:**
- Consumes: the working toolchain from Task 0.
- Produces: a clean-build guarantee that Tasks 2 to 4 rely on, and `/tmp/openapi-baseline.txt` (sorted generated files with checksums) for Task 2.

- [ ] **Step 1: Reproduce the failure and capture the diagnosis**

Run: `cd backend && ./mvnw -B clean compile 2>&1 | tee /tmp/build-before.log`
Expected: FAIL with `cannot find symbol` / `package ...api does not exist` for `PropertiesApi`, `PropertyResponse` and similar. Run `grep -nE "openapi-generator|maven-compiler-plugin|generate-sources|compile" /tmp/build-before.log` and record the order the goals ran in. The plugin's default phase is already `generate-sources`, so the real cause is unconfirmed. If the build passes, run `./mvnw -B -X clean compile`, and try the Docker build as well (`docker build -f dockerfile backend`): the reported failure may only occur there. Record which environment fails.

- [ ] **Step 2: Bind generation explicitly in `backend/pom.xml`**

In the `generate-api` execution add `<phase>generate-sources</phase>`. Add `<addCompileSourceRoot>true</addCompileSourceRoot>` and `<output>${project.build.directory}/generated-sources/openapi</output>` to its `<configuration>`. Move the whole `openapi-generator-maven-plugin` `<plugin>` block above the `maven-compiler-plugin` block, so the declaration order matches the lifecycle order. If Step 1 showed another cause (for example the explicit `default-compile` execution overriding something), fix that instead and keep these settings.

- [ ] **Step 3: Verify from a clean state**

Run: `cd backend && rm -rf target && ./mvnw -B clean compile`
Expected: `BUILD SUCCESS`, and `target/generated-sources/openapi/src/main/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/api/PropertiesApi.java` exists. In the log, `openapi-generator-maven-plugin:7.8.0:generate` appears before `maven-compiler-plugin:compile`.

- [ ] **Step 4: Verify the full lifecycle and tests**

Run: `cd backend && ./mvnw -B clean package`
Expected: `BUILD SUCCESS` (CI runs this exact command, with Postgres available; start it with `docker compose up -d postgres` if tests need it).

- [ ] **Step 5: Capture the baseline for Task 2**

Run: `cd backend/target/generated-sources/openapi && find . -name '*.java' | sort | xargs shasum > /tmp/openapi-baseline.txt && wc -l /tmp/openapi-baseline.txt`
Expected: 14 lines (`ApiUtil` plus 3 `*Api` interfaces plus 11 models, matching the files listed in `target/` today).

- [ ] **Step 6: Commit**

```bash
git add backend/pom.xml
git commit -m "fix(build): generate OpenAPI sources in generate-sources before compile"
```

---

### Task 2: Move and split `openapi.yaml` into multiple files

**Files:**
- Move: `backend/openapi.yaml` to `backend/src/main/resources/openapi/openapi.yaml` (use `git mv`)
- Create: `backend/src/main/resources/openapi/paths/properties.yaml`, `properties_{propertyId}.yaml`, `users.yaml`, `users_{userId}.yaml`, `vendors.yaml`, `vendors_{vendorUuid}.yaml`
- Create: `backend/src/main/resources/openapi/components/schemas/<Name>.yaml` for each of: `PropertyCreateRequest`, `PropertyResponse`, `VendorStatus`, `PaymentMethod`, `VendorCreateRequest`, `VendorUpdateRequest`, `VendorResponse`, `UserCreateRequest`, `UserUpdateRequest`, `UserResponse`, `ErrorResponse`
- Create: `backend/src/main/resources/openapi/components/parameters/VendorUuid.yaml`
- Create: `backend/src/test/java/org/dsd/cohort2026fall/tdr/invoiceautomationservice/OpenApiSpecStructureTest.java`
- Modify: `backend/pom.xml` (`<inputSpec>`)

**Interfaces:**
- Consumes: the clean-build guarantee and `/tmp/openapi-baseline.txt` from Task 1.
- Produces: a root `openapi.yaml` whose `paths` and `components` contain only `$ref`s, at the path `backend/src/main/resources/openapi/openapi.yaml`. Tasks 3 and 5 depend on that path.

Root shape (the one pinned example):

```yaml
paths:
  /api/v1/properties:
    $ref: './paths/properties.yaml'
  /api/v1/properties/{propertyId}:
    $ref: './paths/properties_{propertyId}.yaml'
components:
  parameters:
    VendorUuid:
      $ref: './components/parameters/VendorUuid.yaml'
  schemas:
    PropertyResponse:
      $ref: './components/schemas/PropertyResponse.yaml'
```

Inside path fragments, references to components use `$ref: '../components/schemas/PropertyResponse.yaml'` (relative to the fragment's own file). Within `components/schemas/*.yaml`, use `./Other.yaml`.

- [ ] **Step 1: Write the structure check (the failing test)**

Create `OpenApiSpecStructureTest` with `@Test void rootSpecOnlyReferencesFragments()`: reads `src/main/resources/openapi/openapi.yaml`, asserts fewer than 80 lines, that each entry under `paths:` is a single `$ref`, and that every referenced file exists. Add `@Test void everyFragmentRefResolves()`: walks `src/main/resources/openapi/**/*.yaml`, extracts each `$ref:` value that is a file path, resolves it relative to the containing file, and asserts the target exists. Plain `java.nio.file` and regex; no new dependency.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw -B -Dtest=OpenApiSpecStructureTest test`
Expected: FAIL (the spec file is not at the new path yet, and the old file is 501 lines).

- [ ] **Step 3: Move the file and update the generator**

Run `mkdir -p backend/src/main/resources/openapi && git mv backend/openapi.yaml backend/src/main/resources/openapi/openapi.yaml`. Change `<inputSpec>` in `backend/pom.xml` to `${project.basedir}/src/main/resources/openapi/openapi.yaml`.

- [ ] **Step 4: Prove the move alone changed nothing**

Run: `cd backend && ./mvnw -B clean compile && (cd target/generated-sources/openapi && find . -name '*.java' | sort | xargs shasum) > /tmp/openapi-after.txt && diff /tmp/openapi-baseline.txt /tmp/openapi-after.txt && echo IDENTICAL`
Expected: `IDENTICAL`. This separates "the path moved" failures from "the split broke it" failures.

- [ ] **Step 5: Split paths and components**

Cut each block verbatim (no content edits) from the root file into the files listed above. Rewrite only the `$ref` values: `'#/components/schemas/X'` becomes `'../components/schemas/X.yaml'` from `paths/`, and `'./X.yaml'` between schemas. Rewrite parameter refs the same way. Leave `openapi`, `info`, `servers` in the root file. Keep `{}` in the path-item file names (valid on macOS, Linux and in Git).

- [ ] **Step 6: Run the structure test to verify it passes**

Run: `cd backend && ./mvnw -B -Dtest=OpenApiSpecStructureTest test`
Expected: PASS.

- [ ] **Step 7: Prove the generated output is unchanged**

Run the Step 4 command again.
Expected: `IDENTICAL`. Any difference means the split changed the contract: fix the fragment, never the baseline. If the generator drops or renames anything because of braces in the file names, rename those fragments to `properties_by_id.yaml` style and note it in the commit message.

- [ ] **Step 8: Run the full suite and check the live spec**

Run: `cd backend && ./mvnw -B clean package`
Expected: `BUILD SUCCESS`, including `VendorControllerTest`.
Then start the app (`./mvnw spring-boot:run`) and run `curl -s localhost:8080/v3/api-docs | grep -o '"operationId"' | wc -l`. Expected: 12.

- [ ] **Step 9: Commit**

```bash
git add backend/pom.xml backend/src/main/resources/openapi backend/src/test
git commit -m "refactor(api): move openapi.yaml to resources and split into paths and component fragments"
```

---

### Task 3: Rename `dockerfile` to `Dockerfile` and build with `./mvnw`

**Files:**
- Rename: `backend/dockerfile` to `backend/Dockerfile`
- Modify: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consumes: the spec at `backend/src/main/resources/openapi/` (travels with `COPY src`).
- Produces: image `invoice-backend` that `compose.yaml` builds with `dockerfile: Dockerfile` (the compose file already uses the capitalised name, which is why the rename matters on Linux).

- [ ] **Step 1: Rename in Git (two steps, because macOS is case-insensitive)**

Run: `cd backend && git mv dockerfile Dockerfile.tmp && git mv Dockerfile.tmp Dockerfile && git ls-files | grep -i dockerfile`
Expected: exactly `backend/Dockerfile` is listed, with that case.

- [ ] **Step 2: Rewrite the build stage**

Edit `backend/Dockerfile`. Build stage:

```dockerfile
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src ./src
RUN ./mvnw -B package -DskipTests
```

The runtime stage (`eclipse-temurin:21-jre`, `COPY --from=builder`, `EXPOSE 8080`, `CMD`) stays as is. The old `COPY ./openapi.yaml` line is removed, because the spec is now under `src/`. If `./mvnw` fails inside the image for a missing `curl` or `wget`, install one with `apt-get` in the builder stage and note it.

- [ ] **Step 3: Add `backend/.dockerignore`**

Contents: `target/`, `.DS_Store`, `.idea/`, `*.iml`. Do not ignore `.mvn/` or `mvnw`.

- [ ] **Step 4: Verify the Maven versions match and the image builds**

Run: `docker build -f backend/Dockerfile -t invoice-backend backend`
Expected: success; the build log shows `Downloading ... apache-maven-3.10.0-bin.zip`, not Maven 4. Run `docker run --rm --entrypoint java invoice-backend -version` to confirm Java 21.

- [ ] **Step 5: Cascade check for other references**

Run: `grep -rn -i "dockerfile\|maven:" .github compose.yaml backend README.MD`
Expected: no remaining reference to lowercase `dockerfile` or to a `maven:*` image.

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "build(docker): rename backend Dockerfile and build with ./mvnw (single Maven version)"
```

---

### Task 4: Add the frontend image and build the mono-repo with Compose

**Files:**
- Add to Git: `frontend/Dockerfile` (currently untracked)
- Create: `frontend/.dockerignore`
- Modify: `compose.yaml` (new `frontend` service)

**Interfaces:**
- Consumes: `backend` service name and the `backend` network from `compose.yaml`.
- Produces: `docker compose build` builds both images; `docker compose up` serves the UI on `http://localhost:5173`.

- [ ] **Step 1: Review `frontend/Dockerfile`**

It currently reads `FROM node:20-alpine`, copies `package*.json`, runs `npm install --include=optional --platform=linux --arch=x64`, copies sources, exposes 5173, and runs `npm run dev -- --host`. My call: change the base image to `node:22-alpine` so it matches `frontend-ci.yml` (Node 22). Leave the install flags alone; they exist because the lockfile came from macOS and needs Linux optional dependencies. Do not run `npm install` locally.

- [ ] **Step 2: Add `frontend/.dockerignore`**

Contents: `node_modules/`, `node-modules/`, `dist/`, `.DS_Store`. Without it, `COPY . .` copies the 125-package macOS `node_modules` over the Linux install.

- [ ] **Step 3: Add the `frontend` service to `compose.yaml`**

Under `services:`, following the style of the existing `backend` service: `build.context: ./frontend`, `dockerfile: Dockerfile`, `container_name: invoice-automation-frontend`, `ports: ["5173:5173"]`, `depends_on: [backend]`, `networks: [backend]`. Add a `# --- Frontend Layer ---` comment, matching the existing section comments. Do not change any other service.

- [ ] **Step 4: Verify**

Run: `docker compose config --quiet`. Expected: no output (valid file). Then `docker compose build`. Expected: both images build. Then `docker compose up -d` and `curl -sI localhost:5173 | head -1` (expected `HTTP/1.1 200`) and `curl -s localhost:8080/actuator/health` (expected `{"status":"UP"}`). Run `docker compose down` afterwards. Needs `.env` values; if it is missing, copy from the template documented in the README (never commit it).

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore compose.yaml
git commit -m "build: add frontend image and compose service for mono-repo build"
```

---

### Task 5: Update guidelines, README and check CI

**Files:**
- Modify: `.agents/rules/project-guidelines.md` (lines 69 and 75)
- Modify: `README.MD` (tree at line 24, Java version at line 50, "API Contract & Code Generation" section at lines 135 to 160)
- Check (no change expected): `.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml`

**Interfaces:**
- Consumes: the final layout from Tasks 2 to 4.

- [ ] **Step 1: Guidelines line 69**

Replace the "Contract-first workflow" bullet with: change the OpenAPI fragments under `backend/src/main/resources/openapi/` first (root `openapi.yaml`, plus `paths/` and `components/`), then run `./mvnw compile` to regenerate, then implement the generated interfaces. Keep the Flyway sentence unchanged.

- [ ] **Step 2: Guidelines line 75**

Replace the stale-location bullet. The spec no longer lives at the repo root or in `backend/`; it lives at `backend/src/main/resources/openapi/openapi.yaml` and is split into `paths/` and `components/`. Remove "documented at the repo root but lives in `backend/`" because it is no longer an inconsistency once the README is fixed in Step 3. Leave the other two inconsistencies, except Java 17 if Step 3 fixes it (then remove that line too).

- [ ] **Step 3: README**

Update the repository tree entry (line 24) to the new location with `paths/` and `components/`. Change "Java 17+" to "Java 21" (line 50). Rewrite lines 139 to 160: the spec lives at `backend/src/main/resources/openapi/openapi.yaml`; `inputSpec` is `${project.basedir}/src/main/resources/openapi/openapi.yaml` (the current text shows a `../openapi.yaml` value that is not in the pom); the frontend has no `generate-api` script yet, so state that the spec path is what a future TypeScript generator should read, rather than documenting a script that does not exist. Add an "Adding an endpoint" list: create `paths/<name>.yaml`, add one `$ref` under `paths:` in the root, add schemas under `components/schemas/`, run `./mvnw clean compile`, implement the generated interface. State that generation runs before compilation. Add a short "Toolchain" note: JDK via SDKMAN (`sdk env install`), Maven only via `./mvnw`.

- [ ] **Step 4: Check CI**

Run: `grep -n "openapi\|dockerfile\|paths:" .github/workflows/*.yml`
Expected: no matches. Neither workflow filters on paths or mentions the spec, and `./mvnw -B package` already runs from `backend/`, so no CI change is needed. (An earlier draft of this plan listed a CI path update. That was a mistake.)

- [ ] **Step 5: Final end-to-end check**

Run: `rm -rf backend/target && cd backend && ./mvnw -B clean package && cd .. && docker compose build`
Expected: `BUILD SUCCESS` and both images build.

- [ ] **Step 6: Commit**

```bash
git add .agents/rules/project-guidelines.md README.MD
git commit -m "docs: describe split OpenAPI layout, toolchain and guidelines"
```

---

## Self-Review

- **Spec coverage:** moving and splitting the spec is Task 2; the compile-before-generate bug is Task 1; JDK and `./mvnw` setup is Task 0; Dockerfile rename, `./mvnw` and the Maven mismatch is Task 3; the frontend Dockerfile for the mono-repo build is Task 4; guidelines lines 69 and 75 are Task 5.
- **Corrections to the earlier plan:** the spec moves to `src/main/resources/openapi/` (not `backend/api/`); the operation count is 12 (not 13); there is no frontend `generate-api` script to repoint; CI needs no change; the baseline is 14 files.
- **Step scan:** every step names a command with expected output, or an exact file and edit. Task 1 Step 2 is conditional on the Step 1 diagnosis, because the failure has not been reproduced yet.
- **Type consistency:** the spec path `backend/src/main/resources/openapi/openapi.yaml` and `/tmp/openapi-baseline.txt` are the same across tasks.
- **Review Focus coverage:** items 1 and 2 are tested in Task 2 Steps 4 and 7; item 3 in Task 1 Step 3; item 4 in Task 3 Step 4 and Task 4 Step 2; item 5 in Task 3 Step 1; item 6 in Task 1 Step 3.
- **Not in scope (noted only):** the guidelines mention `useRecords=true` for DTOs, but the pom does not set it; changing it would alter the generated output, so it needs its own change. The stray `frontend/node-modules` directory stays.
