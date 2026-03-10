# SOP - GIS Web App (React + OpenLayers)

Last updated: 2026-03-10

**Purpose**
This SOP defines how to set up, run, and operate the GIS web application, and how to perform common layer, style, query, and data-management workflows.

**Scope**
Applies to local development and day-to-day operation of the GIS web client in this repository.

**Tech Stack**
- Frontend: React 19 + Vite
- Mapping: OpenLayers
- Data Services: GeoServer (WMS/WFS/WFS-T)
- UI: Radix Tooltip, Lucide icons
- Export: `jspdf` + `html2canvas`

**Repository Layout (Key Paths)**
- `src/components/GISMap/GISMap.jsx`: Main map container, tools, and workflows orchestration.
- `src/components/subComponents/`: UI panels and modals (attribute table, style editor, query builder, etc.).
- `src/services/Server.js`: GeoServer API integration (WMS/WFS/WFS-T, styles, metadata).
- `src/services/ServerCredentials.js`: GeoServer URL/workspace/auth configuration.
- `src/utils/`: Map utilities, SLD parsing, helpers.

**Prerequisites**
- Node.js LTS installed (and npm).
- GeoServer reachable from the browser (CORS allowed if needed).
- GeoServer workspace exists and contains a metadata layer named `Layer` (used by `getGeoServerLayers`).

**Configuration**
- Update GeoServer connection settings in `src/services/ServerCredentials.js`:
  - `GEOSERVER_URL`: Base URL or proxy path. Default is `/geoserver`.
  - `WORKSPACE`: Workspace name. Default is `gisweb`.
  - `AUTH_HEADER`: Basic auth header built from username/password.
- If the app is hosted separately from GeoServer, configure a proxy in Vite or add CORS headers on GeoServer.

**Runbook: Local Development**
1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`
3. Open the Vite dev URL printed in the terminal.

**Runbook: Build + Preview**
1. Build:
   - `npm run build`
2. Preview:
   - `npm run preview`

**Linting**
- `npm run lint`

**Core Workflows**

**1) Load GeoServer Layers**
- The app reads metadata from the workspace layer `gisweb:Layer` in `getGeoServerLayers`.
- Only layers with `IsShowLayer = true` are shown.
- Sequence and visibility are controlled by `LayerSequenceNo` and `LayerVisibilityOnLoad`.

**2) Add Temporary (Local) Layers**
- Use the "Load Temporary Layers" modal (`LoadTempLayerModal`).
- Supported formats:
  - Shapefile: `.shp` with required `.prj` (optional `.dbf`, `.shx`)
  - `.geojson` / `.json`
  - `.kml`
- Local layers are added client-side only and marked `isLocal: true`.

**3) Attribute Table + Editing (WFS-T)**
- Open Attribute Table from the layer panel.
- Editing uses WFS-T via `updateFeature` and `deleteFeature` in `src/services/Server.js`.
- Batch updates use `batchUpdateFeaturesByProperty` with retry logic and optional geometry updates.
- Ensure WFS-T is enabled in GeoServer and the user has write permissions.

**4) Styling (SLD)**
- Style editing is managed in `StyleEditorCard` and `src/utils/StyleUtils`.
- `getLayerStyle` tries a layer-specific style `${LayerName}_Style`, then falls back to the default style.
- `updateLayerStyle` creates or updates SLDs in GeoServer.
- `setLayerDefaultStyle` sets the default style for a layer.

**5) Query Builder & Analysis**
- Query Builder (`QueryBuilderCard`) supports filtering and report generation.
- Analysis (`AnalysisCard`) uses generated SLDs for visual overlays and can export reports.

**6) Spatial Join**
- Use `SpatialJoinCard` for joins between layers.
- Target and source layers are selected from GeoServer layers list.

**7) Export/Print**
- Map export uses `html2canvas` and `jspdf`.
- Export settings live in `GISMap.jsx` (`printTitle`, `printSubtitle`, `printFileName`, `exportFormat`).

**Operational Notes**
- User preferences are persisted in `localStorage` and cookies (bookmarks, layout mode, units).
- Base layers include OSM and XYZ; configurable in `GISMap.jsx`.
- Search uses Nominatim with a custom user agent string.

**Security Notes**
- GeoServer credentials are currently stored client-side in `src/services/ServerCredentials.js`.
- For production, move credentials to a secure backend or proxy and remove them from the client.

**Troubleshooting**
- Layers not visible:
  - Verify `gisweb:Layer` metadata and `IsShowLayer`/visibility flags.
  - Check GeoServer URL and workspace configuration.
- Attribute edits fail:
  - Confirm WFS-T enabled for the target layer.
  - Ensure GeoServer user permissions allow `WRITE`.
- Style changes do not apply:
  - Verify style exists in the correct workspace or global scope.
  - Re-check `setLayerDefaultStyle` and layer name references.

**Change Control**
- Update this SOP when introducing new workflows, data services, or configuration changes.
