# Architecture GIS - Système de Calques

## Vue d'ensemble

Système GIS complet avec gestion des calques, basé sur **Leaflet + Extension Géoplateforme IGN**
(open source, AGPL-3.0). La logique métier reste en JavaScript, PostgreSQL ne stocke que les données
avec PostGIS pour les index spatiaux.

**Tout le catalogue Géoplateforme IGN est accessible gratuitement et sans clé API.**

> **Note sur la configuration** : Les exemples de code dans ce document utilisent `process.env` pour
> illustrer l'accès aux variables d'environnement. En pratique, le projet utilise un système de
> configuration centralisé ("vault") - voir [CONFIGURATION_VAULT.md](./CONFIGURATION_VAULT.md).

### Modèle de déploiement multi-instance

Ce système GIS s'inscrit dans une **architecture fédérée multi-instance** :

- **Une instance Supabase par entité citoyenne** — Commune, mais aussi :
  - 🏘️ **Arrondissements** (Paris, Lyon, Marseille)
  - 🏠 **Quartiers** / Comités de quartier
  - 🎓 **Universités** / Campus
  - 🏢 **CSE** / Comités d'entreprise
  - 🏛️ **Syndicats de copropriété**
  - 🌿 **Collectifs citoyens** (associations, listes électorales)
- **Pas de `collectivite_id`** dans les tables : l'isolation est assurée par l'instance Supabase
- **Hubs régionaux/nationaux** pour l'agrégation et la comparaison inter-instances
- **Routage par sous-domaine** : `corte.lepp.fr`, `universita.lepp.fr`, `quartier-sud.corte.lepp.fr`
- **100% gratuit et open source** — Voir [FUNDING.md](../FUNDING.md)

#### Hiérarchie géographique des instances

```
lepp.fr (Hub régional)
├── corte.lepp.fr (Commune)
├── universita.lepp.fr (Université)
│   ├── campus-mariani.universita.lepp.fr (Campus)
│   └── campus-grosseti.universita.lepp.fr (Campus)
├── bastia.lepp.fr (Commune)
│   ├── nord.bastia.lepp.fr (Arrondissement)
│   ├── centre.bastia.lepp.fr (Arrondissement)
│   └── sud.bastia.lepp.fr (Arrondissement)
└── ajaccio.lepp.fr (Commune)
```

#### Implications GIS pour le multi-instance

| Aspect                      | Stratégie                                                     |
| --------------------------- | ------------------------------------------------------------- |
| **Périmètre géographique**  | Chaque instance définit son `BOUNDING_BOX` dans le vault      |
| **Centre carte par défaut** | `MAP_DEFAULT_CENTER` spécifique (ex: centre du quartier)      |
| **Données zonage**          | Filtrage par `commune_code` + géométrie d'intersection        |
| **Calques locaux**          | Chaque instance peut ajouter ses propres calques `map_layers` |
| **Agrégation hub**          | Le hub peut agréger les données de ses instances filles       |

#### Configuration vault pour périmètre géographique

```sql
-- Dans instance_config du quartier-sud
INSERT INTO instance_config (key, value, is_secret) VALUES
('MAP_DEFAULT_CENTER', '[42.3050, 9.1480]', false),
('MAP_DEFAULT_ZOOM', '16', false),
('BOUNDING_BOX', '[[42.300, 9.140], [42.310, 9.160]]', false),
('PARENT_INSTANCE', '"corte"', false),
('INSTANCE_TYPE', '"neighborhood"', false);
```

Pour l'analyse d'impact et la stratégie d'acquisition (Municipales 2026), voir
[GIS_IMPACT_ANALYSIS.md](./GIS_IMPACT_ANALYSIS.md). Pour l'architecture multi-instance détaillée,
voir [ARCHITECTURE_MULTI_INSTANCE.md](./ARCHITECTURE_MULTI_INSTANCE.md).

## Stack technique

### Bibliothèques cartographiques

| Package                        | Version | Licence  | Usage                                 |
| ------------------------------ | ------- | -------- | ------------------------------------- |
| `leaflet`                      | ^1.9.4  | BSD-2    | Moteur cartographique (déjà installé) |
| `react-leaflet`                | ^4.2.1  | MIT      | Wrapper React (déjà installé)         |
| `geoportal-extensions-leaflet` | ^2.4.x  | AGPL-3.0 | **Extension IGN** (à ajouter)         |
| `geoportal-access-lib`         | ^3.4.x  | AGPL-3.0 | Accès aux services IGN (dépendance)   |

### Plugins Leaflet complémentaires

| Package                 | Licence | Usage                                    |
| ----------------------- | ------- | ---------------------------------------- |
| `leaflet-draw`          | MIT     | Dessin de polygones, lignes, marqueurs   |
| `leaflet-measure`       | MIT     | Mesure de distances et surfaces          |
| `leaflet-omnivore`      | BSD-2   | Import KML, GPX, CSV, TopoJSON           |
| `leaflet-easyprint`     | MIT     | Export carte en PNG/PDF                  |
| `leaflet.markercluster` | MIT     | Clustering de marqueurs (déjà utilisé ?) |
| `leaflet-geoman`        | MIT     | Alternative à Draw, plus moderne         |

### Installation complète

```bash
# Extension IGN (obligatoire)
npm install geoportal-extensions-leaflet

# Plugins optionnels selon besoins
npm install leaflet-draw leaflet-omnivore leaflet-easyprint
```

### Fonctionnalités incluses dans l'extension IGN

L'extension Géoplateforme pour Leaflet fournit **gratuitement** :

| Widget                              | Description                              |
| ----------------------------------- | ---------------------------------------- |
| `L.geoportalControl.LayerSwitcher`  | Gestionnaire de calques avec opacité     |
| `L.geoportalControl.SearchEngine`   | Recherche d'adresse IGN (autocomplétion) |
| `L.geoportalControl.ReverseGeocode` | Clic → Adresse                           |
| `L.geoportalControl.Route`          | Calcul d'itinéraires                     |
| `L.geoportalControl.Isocurve`       | Isochrones / Isodistances                |
| `L.geoportalControl.ElevationPath`  | Profil altimétrique                      |
| `L.geoportalControl.MousePosition`  | Coordonnées au survol                    |
| `L.geoportalControl.GetFeatureInfo` | Infos au clic sur WMS                    |
| `L.geoportalLayer.WMTS`             | Couches WMTS simplifiées                 |
| `L.geoportalLayer.WMS`              | Couches WMS simplifiées                  |

## Sources de données

- **Géoplateforme IGN** : Catalogue complet (WMTS, WMS, WFS) — **100% gratuit, sans clé API**
- **Mairie de Corte** : Données locales (WMS/WFS/GeoJSON à déterminer)
- **OpenStreetMap** : Tuiles de base (déjà implémenté)

## Catalogue Géoplateforme IGN (gratuit)

### URLs des services

| Service                   | URL GetCapabilities                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **WMTS** (tuiles images)  | `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities`     |
| **WMS Raster**            | `https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities` |
| **WMS Vecteur**           | `https://data.geopf.fr/wms-v/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities` |
| **WFS** (données vecteur) | `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities`   |
| **Tuiles vectorielles**   | `https://data.geopf.fr/tms/1.0.0/PLAN.IGN/metadata.json`                            |

### Calques disponibles par catégorie

#### 🗺️ Fonds de carte (WMTS)

| Calque      | Nom technique                          | Format |
| ----------- | -------------------------------------- | ------ |
| Plan IGN    | `GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2`    | PNG    |
| Orthophotos | `ORTHOIMAGERY.ORTHOPHOTOS`             | JPEG   |
| Cadastre    | `CADASTRALPARCELS.PARCELLAIRE_EXPRESS` | PNG    |

#### 🏠 Topographie - BD TOPO (WFS)

| Calque      | Nom technique                    | Usage                     |
| ----------- | -------------------------------- | ------------------------- |
| Bâtiments   | `BDTOPO_V3:batiment`             | Emprise des constructions |
| Routes      | `BDTOPO_V3:troncon_de_route`     | Réseau routier            |
| Cours d'eau | `BDTOPO_V3:troncon_de_cours_eau` | Hydrographie              |
| Végétation  | `BDTOPO_V3:zone_de_vegetation`   | Forêts, parcs             |

#### 📍 Adresses (WFS)

| Calque                | Nom technique                                   | Usage                |
| --------------------- | ----------------------------------------------- | -------------------- |
| Parcelles cadastrales | `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle` | Limites parcellaires |

#### 🏔️ Altimétrie - LiDAR HD (WMS Raster)

| Calque        | Nom technique                                              | Usage              |
| ------------- | ---------------------------------------------------------- | ------------------ |
| MNT (terrain) | `IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW` | Relief du sol      |
| MNS (surface) | `IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW` | Relief + bâtiments |
| MNH (hauteur) | `IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW` | Hauteur des objets |

#### 🏛️ Administratif (WMS/WFS)

| Calque        | Nom technique                            | Usage                  |
| ------------- | ---------------------------------------- | ---------------------- |
| Limites admin | `LIMITES_ADMINISTRATIVES_EXPRESS.LATEST` | Communes, départements |
| Admin Express | `ADMIN_EXPRESS` (tuiles vectorielles)    | Limites vectorielles   |

#### 🌳 Environnement (WMS/WFS - thématique "experts")

| Calque            | Thématique    | Usage                   |
| ----------------- | ------------- | ----------------------- |
| BD Forêt          | environnement | Zones forestières       |
| Occupation du sol | sol           | CoSIA, OCS GE           |
| Corine Land Cover | clc           | Usage des sols européen |

### Exemple d'intégration Leaflet

```javascript
// Plan IGN (WMTS) - GRATUIT
const PlanIGN = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM" +
    "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png" +
    "&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
  { attribution: "Carte © IGN/Geoplateforme" }
);

// Orthophotos (WMTS) - GRATUIT
const OrthoIGN = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM" +
    "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg" +
    "&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
  { attribution: "Carte © IGN/Geoplateforme" }
);

// Cadastre (WMTS) - GRATUIT
const Cadastre = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM" +
    "&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png" +
    "&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
  { attribution: "Carte © IGN/Geoplateforme", opacity: 0.7 }
);

// LiDAR MNT (WMS) - GRATUIT
const LidarMNT = L.tileLayer.wms("https://data.geopf.fr/wms-r/wms", {
  layers: "IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW",
  format: "image/png",
  transparent: true,
  attribution: "Carte © IGN/Geoplateforme",
});
```

### Services de géocodage (gratuits)

| Service           | URL                                          | Usage                     |
| ----------------- | -------------------------------------------- | ------------------------- |
| Géocodage         | `https://data.geopf.fr/geocodage/search`     | Adresse → Coordonnées     |
| Géocodage inverse | `https://data.geopf.fr/geocodage/reverse`    | Coordonnées → Adresse     |
| Autocomplétion    | `https://data.geopf.fr/geocodage/completion` | Suggestions en temps réel |

### Données nécessitant une licence (hors scope initial)

Seules ces données nécessitent une licence :

- **SCAN 25** : Cartes de randonnée 1:25000
- **SCAN 100** : Cartes routières 1:100000
- **SCAN OACI** : Cartes aéronautiques

Pour y accéder : créer un compte sur [geoservices.ign.fr](https://geoservices.ign.fr)

## Structure de données existante

### Géolocalisation dans les posts

Les locations sont stockées en JSONB dans `posts.metadata` :

```javascript
{
  location: {
    lat: number,      // Latitude
    lng: number,      // Longitude
    address?: string, // Adresse géocodée
    source?: string,  // 'manual' | 'gps'
    accuracy?: number // Précision GPS
  }
}
```

### Composants existants

| Composant            | Rôle                           |
| -------------------- | ------------------------------ |
| `MapContainer.jsx`   | Conteneur Leaflet + tuiles OSM |
| `LocationMarker.jsx` | Marqueur cliquable             |
| `LocationButton.jsx` | Bouton GPS                     |
| `AddressSearch.jsx`  | Recherche Nominatim            |
| `IncidentLayer.jsx`  | Calque des incidents           |
| `EventLayer.jsx`     | Calque des événements          |

## Structure SQL proposée

```sql
-- Extension PostGIS (pour index spatiaux uniquement)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Colonne géographique sur posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Index spatial pour requêtes performantes
CREATE INDEX IF NOT EXISTS posts_geom_idx ON public.posts USING GIST (geom);

-- Table des calques de carte
CREATE TABLE public.map_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  layer_type text NOT NULL,              -- 'base' | 'overlay'
  source_type text NOT NULL,             -- 'xyz' | 'wmts' | 'wms' | 'geojson'
  url text NOT NULL,
  api_key_env text,                      -- Nom de la variable d'env pour clé API (optionnel)
  attribution text,
  min_zoom integer DEFAULT 0,
  max_zoom integer DEFAULT 19,
  default_opacity numeric(3,2) DEFAULT 1.0,
  z_index integer DEFAULT 0,
  is_default_visible boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',           -- Options spécifiques (layers WMS, bounding_box, etc.)
  -- NOTE: Pas de collectivite_id car isolation par instance Supabase
  -- Chaque instance a ses propres calques personnalisés
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Préférences utilisateur par calque
CREATE TABLE public.user_layer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  layer_id uuid NOT NULL REFERENCES public.map_layers(id) ON DELETE CASCADE,
  is_visible boolean DEFAULT true,
  opacity numeric(3,2),
  UNIQUE(user_id, layer_id)
);

-- RLS basique
ALTER TABLE public.map_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_layer_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Calques actifs visibles par tous" ON public.map_layers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Préférences propres à l'utilisateur" ON public.user_layer_preferences
  FOR ALL USING (auth.uid() = user_id);
```

### Données initiales des calques

```sql
-- Calques de base (fonds de carte)
INSERT INTO public.map_layers (name, description, layer_type, source_type, url, attribution, is_default_visible, z_index, metadata) VALUES
  ('OpenStreetMap', 'Carte communautaire mondiale', 'base', 'xyz',
   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
   '© OpenStreetMap contributors', true, 0, '{"category": "fonds"}'),

  ('Plan IGN', 'Carte IGN officielle', 'base', 'wmts',
   'https://data.geopf.fr/wmts?&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
   'Carte © IGN/Geoplateforme', false, 0, '{"category": "fonds"}'),

  ('Orthophotos IGN', 'Photos aériennes haute résolution', 'base', 'wmts',
   'https://data.geopf.fr/wmts?&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
   'Carte © IGN/Geoplateforme', false, 0, '{"category": "fonds"}');

-- Calques superposables (overlays)
INSERT INTO public.map_layers (name, description, layer_type, source_type, url, attribution, is_default_visible, default_opacity, z_index, metadata) VALUES
  ('Cadastre', 'Parcelles cadastrales', 'overlay', 'wmts',
   'https://data.geopf.fr/wmts?&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&FORMAT=image/png&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}',
   'Carte © IGN/Geoplateforme', false, 0.7, 10, '{"category": "cadastre"}'),

  ('Limites administratives', 'Communes et départements', 'overlay', 'wms',
   'https://data.geopf.fr/wms-r/wms',
   'Carte © IGN/Geoplateforme', false, 0.8, 15, '{"category": "administratif", "layers": "LIMITES_ADMINISTRATIVES_EXPRESS.LATEST"}'),

  ('Relief LiDAR (MNT)', 'Modèle numérique de terrain haute précision', 'overlay', 'wms',
   'https://data.geopf.fr/wms-r/wms',
   'Carte © IGN/Geoplateforme', false, 0.6, 5, '{"category": "altimetrie", "layers": "IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW"}'),

  ('Bâtiments BD TOPO', 'Emprise des constructions', 'overlay', 'wfs',
   'https://data.geopf.fr/wfs/ows',
   'Carte © IGN/Geoplateforme', false, 0.8, 20, '{"category": "topographie", "typeName": "BDTOPO_V3:batiment"}'),

  ('Routes BD TOPO', 'Réseau routier détaillé', 'overlay', 'wfs',
   'https://data.geopf.fr/wfs/ows',
   'Carte © IGN/Geoplateforme', false, 0.8, 18, '{"category": "topographie", "typeName": "BDTOPO_V3:troncon_de_route"}');
```

## Logique JavaScript

### Synchronisation location → geometry

```javascript
// Dans lib/geo.js ou hooks/useMapLayers.js
export function locationToGeom(location) {
  if (!location?.lat || !location?.lng) return null;
  return `SRID=4326;POINT(${location.lng} ${location.lat})`;
}

// Lors de la création/update d'un post avec location
const postData = {
  content,
  metadata: { ...metadata, location },
  geom: locationToGeom(location), // Sync JS, pas trigger SQL
};
```

### Hook useMapLayers

```javascript
// src/hooks/useMapLayers.js
export function useMapLayers() {
  // Charger les calques depuis map_layers
  // Gérer les préférences utilisateur
  // Fournir les fonctions toggle/opacity
}
```

## Composants à créer

Grâce à l'extension IGN, la plupart des widgets sont prêts à l'emploi. Reste à créer :

1. **`GeoportalMap.jsx`** - Wrapper React intégrant les contrôles IGN
2. **`WFSLayer.jsx`** - Support des données vecteur WFS (BD TOPO, parcelles) - non inclus dans
   l'extension

### Exemple d'intégration React

```jsx
// src/components/map/GeoportalMap.jsx
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Import de l'extension Géoplateforme
import "geoportal-extensions-leaflet";
import "geoportal-extensions-leaflet/dist/GpPluginLeaflet.css";

export function GeoportalMap({ center = [42.3094, 9.149], zoom = 13 }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;

    // Créer la carte
    const map = L.map(mapRef.current, {
      center,
      zoom,
    });

    // Ajouter les couches IGN (WMTS simplifié)
    const planIGN = L.geoportalLayer.WMTS({
      layer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    });

    const ortho = L.geoportalLayer.WMTS({
      layer: "ORTHOIMAGERY.ORTHOPHOTOS",
    });

    const cadastre = L.geoportalLayer.WMTS({
      layer: "CADASTRALPARCELS.PARCELLAIRE_EXPRESS",
      opacity: 0.7,
    });

    // Ajouter le Plan IGN par défaut
    planIGN.addTo(map);

    // Ajouter le gestionnaire de calques IGN
    const layerSwitcher = L.geoportalControl.LayerSwitcher({
      layers: [
        { layer: planIGN, config: { title: "Plan IGN", visibility: true } },
        { layer: ortho, config: { title: "Orthophotos", visibility: false } },
        { layer: cadastre, config: { title: "Cadastre", visibility: false } },
      ],
      options: { collapsed: true },
    });
    map.addControl(layerSwitcher);

    // Ajouter la recherche d'adresse IGN
    const searchEngine = L.geoportalControl.SearchEngine({
      displayAdvancedSearch: false,
      zoomTo: "auto",
    });
    map.addControl(searchEngine);

    // Ajouter le géocodage inverse (clic → adresse)
    const reverseGeocode = L.geoportalControl.ReverseGeocode({
      collapsed: true,
    });
    map.addControl(reverseGeocode);

    // Ajouter les coordonnées au survol
    const mousePosition = L.geoportalControl.MousePosition({
      collapsed: true,
    });
    map.addControl(mousePosition);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [center, zoom]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}
```

### Intégration avec react-leaflet existant

Si vous préférez garder react-leaflet, créez un composant hybride :

```jsx
// src/components/map/GeoportalControls.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "geoportal-extensions-leaflet";
import "geoportal-extensions-leaflet/dist/GpPluginLeaflet.css";

export function GeoportalControls() {
  const map = useMap();

  useEffect(() => {
    // Ajouter le gestionnaire de calques
    const layerSwitcher = L.geoportalControl.LayerSwitcher();
    map.addControl(layerSwitcher);

    // Ajouter la recherche d'adresse
    const searchEngine = L.geoportalControl.SearchEngine({
      displayAdvancedSearch: false,
    });
    map.addControl(searchEngine);

    return () => {
      map.removeControl(layerSwitcher);
      map.removeControl(searchEngine);
    };
  }, [map]);

  return null;
}

// Usage dans MapContainer existant
<MapContainer center={[42.3094, 9.149]} zoom={13}>
  <TileLayer url="..." />
  <GeoportalControls />
  <IncidentLayer />
</MapContainer>;
```

## Services à intégrer

### Géocodage IGN (déjà inclus dans l'extension)

Le widget `L.geoportalControl.SearchEngine` gère automatiquement l'autocomplétion d'adresses, la
recherche de lieux et le zoom automatique sur le résultat.

Pour un usage programmatique (hors widget), utilisez `geoportal-access-lib` :

```javascript
// src/lib/geocoding.js
import Gp from "geoportal-access-lib";

export async function searchAddress(query, options = {}) {
  return new Promise((resolve, reject) => {
    Gp.Services.geocode({
      location: query,
      filterOptions: {
        type: ["StreetAddress", "PositionOfInterest"],
        ...(options.departement && { departmentCode: options.departement }),
      },
      maximumResponses: options.limit || 5,
      onSuccess: (response) => resolve(response.locations),
      onFailure: (error) => reject(error),
    });
  });
}

export async function reverseGeocode(lat, lng) {
  return new Promise((resolve, reject) => {
    Gp.Services.reverseGeocode({
      position: { x: lng, y: lat },
      onSuccess: (response) => resolve(response.locations[0]),
      onFailure: (error) => reject(error),
    });
  });
}
```

### Chargement WFS (données vecteur)

```javascript
// src/lib/wfs.js
const WFS_URL = "https://data.geopf.fr/wfs/ows";

export async function fetchWFSFeatures(typeName, bbox, options = {}) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName,
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    ...(bbox && { bbox: bbox.join(",") + ",EPSG:4326" }),
    ...(options.count && { count: options.count }),
  });

  const response = await fetch(`${WFS_URL}?${params}`);
  return response.json(); // GeoJSON
}
```

## Plugins Leaflet - Exemples d'utilisation

### Dessin de zones (leaflet-draw)

```jsx
// src/components/map/DrawControl.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

export function DrawControl({ onCreated, onEdited, onDeleted }) {
  const map = useMap();

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polygon: true,
        polyline: true,
        rectangle: true,
        circle: true,
        marker: true,
        circlemarker: false,
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.addLayer(e.layer);
      onCreated?.(e.layer.toGeoJSON());
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      const geojson = [];
      e.layers.eachLayer((layer) => geojson.push(layer.toGeoJSON()));
      onEdited?.(geojson);
    });

    map.on(L.Draw.Event.DELETED, (e) => {
      const geojson = [];
      e.layers.eachLayer((layer) => geojson.push(layer.toGeoJSON()));
      onDeleted?.(geojson);
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onCreated, onEdited, onDeleted]);

  return null;
}
```

### Import GPX/KML (leaflet-omnivore)

```jsx
// src/components/map/FileImport.jsx
import { useCallback } from "react";
import { useMap } from "react-leaflet";
import omnivore from "leaflet-omnivore";

export function FileImportButton({ onImport }) {
  const map = useMap();

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        let layer;

        if (file.name.endsWith(".gpx")) {
          layer = omnivore.gpx.parse(content);
        } else if (file.name.endsWith(".kml")) {
          layer = omnivore.kml.parse(content);
        } else if (file.name.endsWith(".geojson") || file.name.endsWith(".json")) {
          layer = L.geoJSON(JSON.parse(content));
        }

        if (layer) {
          layer.addTo(map);
          map.fitBounds(layer.getBounds());
          onImport?.(layer.toGeoJSON());
        }
      };
      reader.readAsText(file);
    },
    [map, onImport]
  );

  return (
    <div className="leaflet-control leaflet-bar">
      <label className="leaflet-control-button" title="Importer GPX/KML">
        <input
          type="file"
          accept=".gpx,.kml,.geojson,.json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        📁
      </label>
    </div>
  );
}
```

### Export carte en image (leaflet-easyprint)

```jsx
// src/components/map/PrintControl.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-easyprint";

export function PrintControl() {
  const map = useMap();

  useEffect(() => {
    const printControl = L.easyPrint({
      title: "Exporter la carte",
      position: "topright",
      sizeModes: ["A4Portrait", "A4Landscape"],
      filename: "carte-corte",
      exportOnly: true,
      hideControlContainer: true,
    });
    map.addControl(printControl);

    return () => map.removeControl(printControl);
  }, [map]);

  return null;
}
```

### Mesure de distances (leaflet-measure)

```jsx
// src/components/map/MeasureControl.jsx
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-measure";
import "leaflet-measure/dist/leaflet-measure.css";

export function MeasureControl() {
  const map = useMap();

  useEffect(() => {
    const measureControl = new L.Control.Measure({
      position: "topright",
      primaryLengthUnit: "meters",
      secondaryLengthUnit: "kilometers",
      primaryAreaUnit: "sqmeters",
      secondaryAreaUnit: "hectares",
      activeColor: "#3388ff",
      completedColor: "#2e7d32",
      localization: "fr",
    });
    map.addControl(measureControl);

    return () => map.removeControl(measureControl);
  }, [map]);

  return null;
}
```

## Suivi des changements de zonage urbanistique

### Le problème : détecter les parcelles qui deviennent constructibles

Quand une parcelle passe de zone Agricole (A) ou Naturelle (N) vers zone Urbanisée (U) ou À
Urbaniser (AU), sa valeur peut être multipliée par 10 à 100. C'est un enjeu financier majeur pour
les propriétaires et les collectivités.

**Limitation officielle** : Le GPU ne conserve **pas d'historique** des zonages. Seule la version en
vigueur est disponible.

### Solution : créer notre propre historique

```sql
-- Table pour archiver les zonages PLU/PLUi
CREATE TABLE public.zonage_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_code text NOT NULL,                    -- Code INSEE (ex: '2B096' pour Corte)
  document_id text,                              -- ID du document GPU
  document_type text,                            -- 'PLU' | 'PLUi' | 'CC' | 'POS'
  date_publication timestamptz NOT NULL,         -- Date de publication GPU
  date_snapshot timestamptz DEFAULT now(),       -- Date de notre capture
  zonage_geojson jsonb NOT NULL,                 -- GeoJSON complet des zones
  metadata jsonb DEFAULT '{}',                   -- Infos supplémentaires
  created_at timestamptz DEFAULT now()
);

CREATE INDEX zonage_historique_commune_idx ON public.zonage_historique(commune_code);
CREATE INDEX zonage_historique_date_idx ON public.zonage_historique(date_publication);

-- Vue des changements de zonage entre deux versions
CREATE VIEW public.v_changements_zonage AS
WITH versions AS (
  SELECT
    commune_code,
    date_publication,
    zonage_geojson,
    LAG(zonage_geojson) OVER (PARTITION BY commune_code ORDER BY date_publication) as zonage_precedent,
    LAG(date_publication) OVER (PARTITION BY commune_code ORDER BY date_publication) as date_precedente
  FROM public.zonage_historique
)
SELECT * FROM versions WHERE zonage_precedent IS NOT NULL;
```

### Sources de données GPU

| Service            | URL                                                            | Usage                                |
| ------------------ | -------------------------------------------------------------- | ------------------------------------ |
| **Flux ATOM**      | `https://www.geoportail-urbanisme.gouv.fr/atom/download-feed/` | Notifications nouvelles publications |
| **WFS Zonage**     | `https://data.geopf.fr/wfs/ows` + `GPU:zone_urba`              | Télécharger les zones                |
| **WMS**            | `https://data.geopf.fr/wms-v/ows`                              | Visualisation                        |
| **Export hebdo**   | SFTP (CSV, GeoPackage, Shapefile)                              | Téléchargement massif                |
| **Téléchargement** | `https://data.geopf.fr/telechargement/resource/pack_plu`       | Archives PLU par commune             |

### Codes de zonage à surveiller

| Code             | Signification           | Constructible ?    |
| ---------------- | ----------------------- | ------------------ |
| **U**            | Zone Urbanisée          | ✅ Oui             |
| **AU** / **1AU** | À Urbaniser (immédiate) | ✅ Oui             |
| **2AU**          | À Urbaniser (différée)  | ⏳ Sous conditions |
| **A**            | Agricole                | ❌ Non             |
| **N**            | Naturelle               | ❌ Non             |

Un changement `A → AU` ou `N → U` = **parcelle devenue constructible** 🎯

### Job de synchronisation ATOM

```javascript
// scripts/sync-gpu-zonage.js
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

const ATOM_URL = "https://www.geoportail-urbanisme.gouv.fr/atom/download-feed/";
const WFS_URL = "https://data.geopf.fr/wfs/ows";

// Communes à surveiller (exemple: Corse)
const COMMUNES_SURVEILLEES = [
  "2B096", // Corte
  "2A004", // Ajaccio
  "2B033", // Bastia
  // ... ajouter les communes d'intérêt
];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkAtomFeed() {
  const parser = new Parser();
  const feed = await parser.parseURL(ATOM_URL);

  const nouvellespublications = [];

  for (const item of feed.items) {
    // Extraire le code INSEE du titre (format: "DU_2B096_...")
    const match = item.title?.match(/DU_(\d{5}|\d[AB]\d{3})/);
    if (!match) continue;

    const communeCode = match[1];
    if (!COMMUNES_SURVEILLEES.includes(communeCode)) continue;

    // Vérifier si on a déjà cette version
    const { data: existing } = await supabase
      .from("zonage_historique")
      .select("id")
      .eq("commune_code", communeCode)
      .eq("date_publication", item.pubDate)
      .single();

    if (!existing) {
      nouvellespublications.push({
        communeCode,
        documentId: item.id,
        datePublication: item.pubDate,
        lien: item.link,
      });
    }
  }

  return nouvellespublications;
}

async function telechargerZonage(communeCode) {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeName: "GPU:zone_urba",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    CQL_FILTER: `partition LIKE 'DU_${communeCode}%'`,
  });

  const response = await fetch(`${WFS_URL}?${params}`);
  if (!response.ok) throw new Error(`WFS error: ${response.status}`);

  return response.json();
}

async function archiverZonage(publication, zonageGeoJSON) {
  const { error } = await supabase.from("zonage_historique").insert({
    commune_code: publication.communeCode,
    document_id: publication.documentId,
    document_type: "PLU", // À affiner selon le titre
    date_publication: publication.datePublication,
    zonage_geojson: zonageGeoJSON,
    metadata: { source: "GPU", lien: publication.lien },
  });

  if (error) throw error;
}

async function detecterChangements(communeCode) {
  // Récupérer les 2 dernières versions
  const { data: versions } = await supabase
    .from("zonage_historique")
    .select("zonage_geojson, date_publication")
    .eq("commune_code", communeCode)
    .order("date_publication", { ascending: false })
    .limit(2);

  if (versions.length < 2) return null;

  const [nouveau, ancien] = versions;
  const changements = [];

  // Comparer les zones par ID de parcelle/section
  const anciennes = new Map(
    ancien.zonage_geojson.features.map((f) => [f.properties.idurba || f.id, f.properties.typezone])
  );

  for (const feature of nouveau.zonage_geojson.features) {
    const id = feature.properties.idurba || feature.id;
    const ancienType = anciennes.get(id);
    const nouveauType = feature.properties.typezone;

    if (ancienType && ancienType !== nouveauType) {
      // Changement détecté !
      const devientConstructible =
        ["A", "N"].includes(ancienType) && ["U", "AU", "1AU"].includes(nouveauType);

      changements.push({
        id,
        ancienType,
        nouveauType,
        devientConstructible,
        geometry: feature.geometry,
        libelle: feature.properties.libelle,
      });
    }
  }

  return changements;
}

// Point d'entrée principal
export async function syncGPU() {
  console.log("🔍 Vérification du flux ATOM GPU...");
  const nouvelles = await checkAtomFeed();

  if (nouvelles.length === 0) {
    console.log("✅ Aucune nouvelle publication");
    return { nouvelles: 0, changements: [] };
  }

  console.log(`📥 ${nouvelles.length} nouvelle(s) publication(s) détectée(s)`);
  const tousChangements = [];

  for (const pub of nouvelles) {
    console.log(`  → Téléchargement zonage ${pub.communeCode}...`);
    const zonage = await telechargerZonage(pub.communeCode);
    await archiverZonage(pub, zonage);

    const changements = await detecterChangements(pub.communeCode);
    if (changements?.length > 0) {
      console.log(`  🎯 ${changements.length} changement(s) de zonage !`);
      tousChangements.push(
        ...changements.map((c) => ({
          ...c,
          commune: pub.communeCode,
        }))
      );
    }
  }

  return { nouvelles: nouvelles.length, changements: tousChangements };
}
```

### Cron job (Netlify/Supabase)

```javascript
// netlify/functions/scheduled-gpu-sync.js
import { syncGPU } from "../../scripts/sync-gpu-zonage.js";
import { schedule } from "@netlify/functions";

// Exécution quotidienne à 6h du matin
export const handler = schedule("0 6 * * *", async () => {
  try {
    const result = await syncGPU();

    // Si des parcelles deviennent constructibles, envoyer une alerte
    const constructibles = result.changements.filter((c) => c.devientConstructible);

    if (constructibles.length > 0) {
      // TODO: Envoyer notification (email, webhook, notification in-app)
      console.log(`🚨 ALERTE: ${constructibles.length} parcelle(s) devenue(s) constructible(s) !`);
      for (const c of constructibles) {
        console.log(`   - ${c.commune}: ${c.id} (${c.ancienType} → ${c.nouveauType})`);
      }
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error("Erreur sync GPU:", error);
    return { statusCode: 500, body: error.message };
  }
});
```

### Table des alertes

```sql
-- Table pour stocker les alertes de changement
CREATE TABLE public.alertes_zonage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_code text NOT NULL,
  parcelle_id text,
  ancien_zonage text NOT NULL,
  nouveau_zonage text NOT NULL,
  devient_constructible boolean DEFAULT false,
  geometry geometry(Geometry, 4326),
  date_changement timestamptz NOT NULL,
  notifie boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX alertes_zonage_constructible_idx
  ON public.alertes_zonage(devient_constructible)
  WHERE devient_constructible = true;

-- RLS: visible par les admins et membres de la collectivité
ALTER TABLE public.alertes_zonage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alertes visibles par admins" ON public.alertes_zonage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.role = 'modo')
    )
  );
```

### Composant React d'affichage des alertes

```jsx
// src/components/admin/ZoningAlerts.jsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function ZoningAlerts() {
  const { data: alertes, isLoading } = useQuery({
    queryKey: ["alertes-zonage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertes_zonage")
        .select("*")
        .eq("devient_constructible", true)
        .order("date_changement", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        🎯 Parcelles devenues constructibles
      </h2>

      {alertes?.length === 0 ? (
        <p className="text-gray-500">Aucune alerte récente</p>
      ) : (
        <div className="space-y-2">
          {alertes?.map((alerte) => (
            <div key={alerte.id} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-semibold">Commune {alerte.commune_code}</span>
                  {alerte.parcelle_id && (
                    <span className="ml-2 text-sm text-gray-600">
                      Parcelle {alerte.parcelle_id}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(alerte.date_changement).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <div className="mt-2 text-sm">
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {alerte.ancien_zonage}
                </span>
                <span className="mx-2">→</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  {alerte.nouveau_zonage}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Calque cartographique des changements

```jsx
// src/components/map/ZoningChangesLayer.jsx
import { useQuery } from "@tanstack/react-query";
import { GeoJSON } from "react-leaflet";
import { supabase } from "@/lib/supabase";

export function ZoningChangesLayer({ communeCode }) {
  const { data: alertes } = useQuery({
    queryKey: ["alertes-zonage-geo", communeCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertes_zonage")
        .select("*")
        .eq("commune_code", communeCode)
        .eq("devient_constructible", true)
        .not("geometry", "is", null);

      if (error) throw error;

      // Convertir en FeatureCollection
      return {
        type: "FeatureCollection",
        features: data.map((a) => ({
          type: "Feature",
          geometry: a.geometry,
          properties: {
            id: a.id,
            ancien: a.ancien_zonage,
            nouveau: a.nouveau_zonage,
            date: a.date_changement,
          },
        })),
      };
    },
    enabled: !!communeCode,
  });

  if (!alertes?.features?.length) return null;

  return (
    <GeoJSON
      data={alertes}
      style={{
        color: "#22c55e",
        fillColor: "#86efac",
        fillOpacity: 0.5,
        weight: 3,
        dashArray: "5, 5",
      }}
      onEachFeature={(feature, layer) => {
        layer.bindPopup(`
          <strong>Zone devenue constructible</strong><br/>
          ${feature.properties.ancien} → ${feature.properties.nouveau}<br/>
          <em>${new Date(feature.properties.date).toLocaleDateString("fr-FR")}</em>
        `);
      }}
    />
  );
}
```

### Limitations et alternatives

| Approche                    | Avantages                             | Inconvénients                            |
| --------------------------- | ------------------------------------- | ---------------------------------------- |
| **Notre historique**        | Contrôle total, détection automatique | Nécessite stockage, pas de rétroactivité |
| **Export hebdo GPU**        | Données complètes (SFTP)              | Accès SFTP à configurer                  |
| **Cadastre.gouv.fr**        | Historique parcellaire                | Pas les zonages, juste les parcelles     |
| **Observatoire du foncier** | Données agrégées                      | Pas de détail parcelle                   |

### ⚠️ Ce qu'on NE peut PAS récupérer automatiquement

- **Historique antérieur à notre première capture** : impossible de remonter dans le temps via le
  GPU
- **Procédures en cours** : les projets de PLU non encore adoptés
- **Délibérations municipales** : contexte des décisions de zonage

## Reconstitution citoyenne de l'historique 📜

### Principe : faire appel à la mémoire collective

Les citoyens possèdent souvent des **documents d'archive** que l'État n'a pas numérisés :

- Anciens PLU/POS en version papier
- Délibérations municipales
- Actes notariés mentionnant le zonage
- Photos aériennes historiques
- Témoignages oraux datés

### Structure de données pour contributions citoyennes

```sql
-- Contributions citoyennes sur l'historique des zonages
CREATE TABLE public.zonage_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Localisation
  commune_code text NOT NULL,
  parcelle_id text,                              -- Référence cadastrale si connue
  geometry geometry(Geometry, 4326),             -- Zone concernée (dessinée par l'utilisateur)

  -- Information historique
  zonage_declare text NOT NULL,                  -- Zone déclarée (U, AU, A, N, etc.)
  date_debut date,                               -- Date de début de validité (si connue)
  date_fin date,                                 -- Date de fin de validité (si connue)
  periode_estimee text,                          -- Ex: "années 1990", "avant 2000"

  -- Source et preuves
  type_source text NOT NULL,                     -- 'document_officiel' | 'acte_notarie' | 'photo' | 'temoignage' | 'autre'
  description_source text,                       -- Description de la source
  fichiers_joints text[],                        -- URLs des pièces jointes (storage)

  -- Métadonnées contribution
  user_id uuid NOT NULL REFERENCES public.users(id),

  -- Statuts nuancés pour la transparence
  statut text DEFAULT 'en_attente',              -- Voir table des statuts ci-dessous
  niveau_confiance integer DEFAULT 0,            -- 0-100, calculé automatiquement
  verification_notes text,                       -- Notes du modérateur (publiques)
  notes_internes text,                           -- Notes privées (modérateurs uniquement)
  verified_by uuid REFERENCES public.users(id),
  verified_at timestamptz,

  -- Corroboration par d'autres citoyens
  nb_corroborations integer DEFAULT 0,           -- Nombre de confirmations
  nb_contestations integer DEFAULT 0,            -- Nombre de contestations

  -- Gamification
  points_attribues integer DEFAULT 0,            -- Points civiques gagnés

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour recherche géographique
CREATE INDEX zonage_contributions_geom_idx ON public.zonage_contributions USING GIST (geometry);
CREATE INDEX zonage_contributions_commune_idx ON public.zonage_contributions(commune_code);
CREATE INDEX zonage_contributions_statut_idx ON public.zonage_contributions(statut);

-- RLS
ALTER TABLE public.zonage_contributions ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les contributions publiées (tous statuts sauf en_attente et rejete)
CREATE POLICY "Contributions publiées visibles" ON public.zonage_contributions
  FOR SELECT USING (statut NOT IN ('en_attente', 'rejete'));

-- Les utilisateurs voient leurs propres contributions
CREATE POLICY "Voir ses contributions" ON public.zonage_contributions
  FOR SELECT USING (auth.uid() = user_id);

-- Les utilisateurs authentifiés peuvent contribuer
CREATE POLICY "Créer contribution" ON public.zonage_contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Les modérateurs peuvent tout voir et modifier
CREATE POLICY "Modération contributions" ON public.zonage_contributions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.role = 'modo')
    )
  );
```

### Statuts de contribution - Échelle de transparence

| Statut       | Icône | Affichage        | Description                                          |
| ------------ | ----- | ---------------- | ---------------------------------------------------- |
| `en_attente` | ⏳    | Non visible      | En attente de première évaluation                    |
| `a_verifier` | 🔍    | Visible          | Publié mais nécessite vérification par la communauté |
| `incertain`  | ❓    | Visible + alerte | Source faible ou informations contradictoires        |
| `conteste`   | ⚔️    | Visible + débat  | Contesté par d'autres citoyens, débat ouvert         |
| `probable`   | 📊    | Visible          | Vraisemblable mais pas de preuve formelle            |
| `verifie`    | ✅    | Visible          | Vérifié par modérateur et/ou corroboré               |
| `officiel`   | 🏛️    | Visible          | Confirmé par source officielle retrouvée             |
| `rejete`     | ❌    | Non visible      | Faux, incohérent ou malveillant                      |

### Calcul du niveau de confiance (0-100)

```javascript
function calculerConfiance(contribution) {
  let score = 0;

  // Base selon type de source
  const baseScores = {
    document_officiel: 60,
    acte_notarie: 50,
    photo: 35,
    temoignage: 20,
    autre: 10,
  };
  score += baseScores[contribution.type_source] || 10;

  // Bonus pièces jointes
  if (contribution.fichiers_joints?.length > 0) score += 15;

  // Bonus dates précises (pas juste "années 90")
  if (contribution.date_debut && contribution.date_fin) score += 10;

  // Corroborations vs contestations
  score += contribution.nb_corroborations * 8;
  score -= contribution.nb_contestations * 12;

  // Réputation du contributeur (à implémenter)
  // score += contributeur.reputation * 0.1;

  return Math.max(0, Math.min(100, score));
}
```

### Types de sources acceptées

| Type | Fiabilité | Points | Exemple | | `document_officiel` | ⭐⭐⭐⭐⭐ | 50 | Ancien PLU scanné,
délibération CM | | `acte_notarie` | ⭐⭐⭐⭐ | 40 | Acte de vente mentionnant le zonage | | `photo`
| ⭐⭐⭐ | 25 | Photo aérienne datée, vue terrain | | `temoignage` | ⭐⭐ | 15 | Témoignage avec
date précise | | `autre` | ⭐ | 10 | Autre source à évaluer |

### Composant de contribution

```jsx
// src/components/zonage/ContributionForm.jsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DrawControl } from "../map/DrawControl";

const TYPES_ZONAGE = [
  { value: "U", label: "Zone Urbanisée (U)" },
  { value: "AU", label: "À Urbaniser (AU)" },
  { value: "1AU", label: "À Urbaniser immédiate (1AU)" },
  { value: "2AU", label: "À Urbaniser différée (2AU)" },
  { value: "A", label: "Agricole (A)" },
  { value: "N", label: "Naturelle (N)" },
  { value: "NA", label: "Naturelle ancienne (NA)" },
  { value: "NB", label: "Naturelle bâtie (NB)" },
  { value: "NC", label: "Naturelle agricole (NC)" },
  { value: "ND", label: "Naturelle protégée (ND)" },
];

const TYPES_SOURCE = [
  { value: "document_officiel", label: "📄 Document officiel (PLU, délibération)", points: 50 },
  { value: "acte_notarie", label: "📜 Acte notarié", points: 40 },
  { value: "photo", label: "📷 Photo datée", points: 25 },
  { value: "temoignage", label: "🗣️ Témoignage", points: 15 },
  { value: "autre", label: "❓ Autre source", points: 10 },
];

export function ContributionZonageForm({ communeCode, onSuccess }) {
  const [geometry, setGeometry] = useState(null);
  const [fichiers, setFichiers] = useState([]);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();
  const typeSource = watch("type_source");

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Upload des fichiers d'abord
      const fichiersUrls = [];
      for (const fichier of fichiers) {
        const path = `zonage-contributions/${Date.now()}-${fichier.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, fichier);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
          fichiersUrls.push(urlData.publicUrl);
        }
      }

      // Créer la contribution
      const { data: result, error } = await supabase
        .from("zonage_contributions")
        .insert({
          commune_code: communeCode,
          parcelle_id: data.parcelle_id || null,
          geometry: geometry,
          zonage_declare: data.zonage_declare,
          date_debut: data.date_debut || null,
          date_fin: data.date_fin || null,
          periode_estimee: data.periode_estimee || null,
          type_source: data.type_source,
          description_source: data.description_source,
          fichiers_joints: fichiersUrls,
          user_id: (await supabase.auth.getUser()).data.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["zonage-contributions"]);
      onSuccess?.();
    },
  });

  return (
    <form onSubmit={handleSubmit(mutation.mutate)} className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">
          🏛️ Contribuez à l'histoire du territoire
        </h3>
        <p className="text-sm text-blue-700">
          Vous possédez des documents ou souvenirs sur le zonage passé de votre commune ?
          Partagez-les pour aider à reconstituer l'historique urbanistique.
        </p>
      </div>

      {/* Zone géographique */}
      <div>
        <label className="block font-medium mb-2">
          📍 Délimitez la zone concernée sur la carte
        </label>
        <div className="h-64 border rounded-lg overflow-hidden">
          <MapContainer center={[42.3094, 9.149]} zoom={14}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DrawControl onCreated={(geojson) => setGeometry(geojson.geometry)} />
          </MapContainer>
        </div>
        {!geometry && (
          <p className="text-sm text-amber-600 mt-1">Dessinez un polygone pour indiquer la zone</p>
        )}
      </div>

      {/* Référence cadastrale optionnelle */}
      <div>
        <label className="block font-medium mb-1">Référence cadastrale (optionnel)</label>
        <input
          {...register("parcelle_id")}
          placeholder="Ex: 2B096-AB-0042"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Zonage déclaré */}
      <div>
        <label className="block font-medium mb-1">Quel était le zonage ? *</label>
        <select
          {...register("zonage_declare", { required: true })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">Sélectionnez...</option>
          {TYPES_ZONAGE.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
        {errors.zonage_declare && <p className="text-red-500 text-sm">Champ obligatoire</p>}
      </div>

      {/* Période */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-medium mb-1">Date de début</label>
          <input
            type="date"
            {...register("date_debut")}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Date de fin</label>
          <input
            type="date"
            {...register("date_fin")}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="block font-medium mb-1">Période estimée (si dates inconnues)</label>
        <input
          {...register("periode_estimee")}
          placeholder="Ex: années 1980, avant 1995, jusqu'en 2010..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Type de source */}
      <div>
        <label className="block font-medium mb-2">Quelle est votre source ? *</label>
        <div className="space-y-2">
          {TYPES_SOURCE.map((s) => (
            <label
              key={s.value}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="radio"
                {...register("type_source", { required: true })}
                value={s.value}
              />
              <span>{s.label}</span>
              <span className="ml-auto text-sm text-green-600 font-medium">+{s.points} pts</span>
            </label>
          ))}
        </div>
      </div>

      {/* Description de la source */}
      <div>
        <label className="block font-medium mb-1">Décrivez votre source *</label>
        <textarea
          {...register("description_source", { required: true })}
          rows={3}
          placeholder="Ex: Ancien PLU de 1998 trouvé dans les archives familiales, page 24..."
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* Upload de fichiers */}
      <div>
        <label className="block font-medium mb-1">Pièces jointes (photos, scans...)</label>
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => setFichiers(Array.from(e.target.files))}
          className="w-full"
        />
        {fichiers.length > 0 && (
          <p className="text-sm text-gray-600 mt-1">{fichiers.length} fichier(s) sélectionné(s)</p>
        )}
      </div>

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={mutation.isPending || !geometry}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {mutation.isPending ? "Envoi en cours..." : "📤 Soumettre ma contribution"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Votre contribution sera vérifiée par un modérateur avant publication. Les fausses
        déclarations peuvent entraîner une suspension du compte.
      </p>
    </form>
  );
}
```

### Interface de modération

```jsx
// src/components/admin/ModerationZonage.jsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function ModerationZonage() {
  const queryClient = useQueryClient();

  const { data: contributions, isLoading } = useQuery({
    queryKey: ["zonage-contributions-moderation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zonage_contributions")
        .select(
          `
          *,
          user:users(pseudo, avatar_url)
        `
        )
        .eq("statut", "en_attente")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const moderer = useMutation({
    mutationFn: async ({ id, statut, notes, points }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Mettre à jour la contribution
      const { error } = await supabase
        .from("zonage_contributions")
        .update({
          statut,
          verification_notes: notes,
          verified_by: user.id,
          verified_at: new Date().toISOString(),
          points_attribues: statut === "verifie" ? points : 0,
        })
        .eq("id", id);

      if (error) throw error;

      // Si vérifié, attribuer les points civiques
      if (statut === "verifie" && points > 0) {
        // TODO: Incrémenter les points de l'utilisateur
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["zonage-contributions-moderation"]);
    },
  });

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">
        📋 Contributions en attente ({contributions?.length || 0})
      </h2>

      {contributions?.map((contrib) => (
        <div key={contrib.id} className="border rounded-lg p-4 space-y-4">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <img
                src={contrib.user?.avatar_url || "/default-avatar.png"}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium">{contrib.user?.pseudo}</span>
            </div>
            <span className="text-sm text-gray-500">
              {new Date(contrib.created_at).toLocaleDateString("fr-FR")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Commune:</strong> {contrib.commune_code}
            </div>
            <div>
              <strong>Zonage déclaré:</strong>
              <span className="ml-2 px-2 py-1 bg-gray-100 rounded">{contrib.zonage_declare}</span>
            </div>
            <div>
              <strong>Période:</strong>{" "}
              {contrib.periode_estimee ||
                `${contrib.date_debut || "?"} → ${contrib.date_fin || "?"}`}
            </div>
            <div>
              <strong>Type source:</strong> {contrib.type_source}
            </div>
          </div>

          <div>
            <strong>Description:</strong>
            <p className="text-gray-700 mt-1">{contrib.description_source}</p>
          </div>

          {contrib.fichiers_joints?.length > 0 && (
            <div>
              <strong>Pièces jointes:</strong>
              <div className="flex gap-2 mt-2">
                {contrib.fichiers_joints.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    📎 Fichier {i + 1}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Mini carte */}
          {contrib.geometry && (
            <div className="h-48 border rounded overflow-hidden">
              {/* Afficher la géométrie sur une mini carte */}
            </div>
          )}

          {/* Actions de modération - Spectre complet */}
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium text-gray-600">Évaluation :</p>

            {/* Actions positives */}
            <div className="flex gap-2">
              <button
                onClick={() =>
                  moderer.mutate({
                    id: contrib.id,
                    statut: "officiel",
                    notes: "Confirmé par source officielle",
                    points: 60,
                  })
                }
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                🏛️ Officiel
              </button>
              <button
                onClick={() =>
                  moderer.mutate({
                    id: contrib.id,
                    statut: "verifie",
                    notes: "Vérifié et validé",
                    points: TYPES_SOURCE.find((t) => t.value === contrib.type_source)?.points || 10,
                  })
                }
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                ✅ Vérifié
              </button>
              <button
                onClick={() =>
                  moderer.mutate({
                    id: contrib.id,
                    statut: "probable",
                    notes: "Vraisemblable, en attente de confirmation",
                    points: Math.round(
                      (TYPES_SOURCE.find((t) => t.value === contrib.type_source)?.points || 10) *
                        0.7
                    ),
                  })
                }
                className="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-sm"
              >
                📊 Probable
              </button>
            </div>

            {/* Zone grise - Transparence */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const notes = prompt("Que faudrait-il pour confirmer ?");
                  moderer.mutate({
                    id: contrib.id,
                    statut: "a_verifier",
                    notes: notes || "À vérifier par la communauté",
                    points: 5,
                  });
                }}
                className="flex-1 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
              >
                🔍 À vérifier
              </button>
              <button
                onClick={() => {
                  const notes = prompt("Quelles sont les incertitudes ?");
                  moderer.mutate({
                    id: contrib.id,
                    statut: "incertain",
                    notes: notes || "Informations incomplètes ou contradictoires",
                    points: 5,
                  });
                }}
                className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"
              >
                ❓ Incertain
              </button>
            </div>

            {/* Rejet */}
            <button
              onClick={() => {
                const notes = prompt("Raison du rejet (sera visible par le contributeur):");
                if (notes) {
                  moderer.mutate({ id: contrib.id, statut: "rejete", notes, points: 0 });
                }
              }}
              className="w-full py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
            >
              ❌ Rejeter (faux/incohérent)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Affichage de l'historique reconstitué

```jsx
// src/components/zonage/HistoriqueZonage.jsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Couleurs et icônes selon le niveau de confiance
const STATUT_CONFIG = {
  officiel: { icon: "🏛️", bg: "bg-blue-50", border: "border-blue-300", label: "Source officielle" },
  verifie: { icon: "✅", bg: "bg-green-50", border: "border-green-300", label: "Vérifié" },
  probable: { icon: "📊", bg: "bg-emerald-50", border: "border-emerald-300", label: "Probable" },
  a_verifier: { icon: "🔍", bg: "bg-amber-50", border: "border-amber-300", label: "À vérifier" },
  incertain: { icon: "❓", bg: "bg-orange-50", border: "border-orange-300", label: "Incertain" },
  conteste: { icon: "⚔️", bg: "bg-red-50", border: "border-red-300", label: "Contesté" },
};

export function HistoriqueZonage({ communeCode, parcelleId }) {
  const { data: historique } = useQuery({
    queryKey: ["historique-zonage", communeCode, parcelleId],
    queryFn: async () => {
      // Combiner données officielles et contributions citoyennes
      const [{ data: officiel }, { data: contributions }] = await Promise.all([
        supabase
          .from("zonage_historique")
          .select("*")
          .eq("commune_code", communeCode)
          .order("date_publication", { ascending: false }),
        supabase
          .from("zonage_contributions")
          .select(
            `
            *,
            user:users(pseudo, avatar_url)
          `
          )
          .eq("commune_code", communeCode)
          .not("statut", "in", '("en_attente","rejete")')
          .order("date_debut", { ascending: false }),
      ]);

      // Fusionner et trier chronologiquement
      const timeline = [
        ...(officiel || []).map((o) => ({
          type: "gpu",
          statut: "officiel",
          date: o.date_publication,
          source: "GPU",
          ...o,
        })),
        ...(contributions || []).map((c) => ({
          type: "contribution",
          date: c.date_debut || c.created_at,
          source: c.type_source,
          ...c,
        })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      return timeline;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold flex items-center gap-2">
          📜 Historique du zonage - {communeCode}
        </h3>
        <div className="text-xs text-gray-500">Transparence : toutes les sources affichées</div>
      </div>

      {/* Légende des niveaux de confiance */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUT_CONFIG).map(([key, config]) => (
          <span key={key} className={`px-2 py-1 rounded ${config.bg} ${config.border} border`}>
            {config.icon} {config.label}
          </span>
        ))}
      </div>

      <div className="relative border-l-2 border-gray-200 pl-4 space-y-4">
        {historique?.map((item, i) => {
          const config = STATUT_CONFIG[item.statut] || STATUT_CONFIG.incertain;

          return (
            <div key={i} className="relative">
              {/* Point sur la timeline avec couleur selon confiance */}
              <div
                className={`absolute -left-6 w-4 h-4 rounded-full flex items-center justify-center text-xs
                ${
                  item.statut === "officiel"
                    ? "bg-blue-500"
                    : item.statut === "verifie"
                      ? "bg-green-500"
                      : item.statut === "probable"
                        ? "bg-emerald-400"
                        : item.statut === "conteste"
                          ? "bg-red-400"
                          : "bg-amber-400"
                }`}
              ></div>

              <div className={`p-3 rounded-lg border ${config.bg} ${config.border}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm">
                      {config.icon} {config.label}
                    </span>
                    <p className="font-medium mt-1">
                      Zone:{" "}
                      <span className="px-2 py-0.5 bg-white rounded">
                        {item.zonage_declare || item.document_type}
                      </span>
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {item.date
                      ? new Date(item.date).toLocaleDateString("fr-FR")
                      : item.periode_estimee}
                  </span>
                </div>

                {/* Barre de confiance visuelle */}
                {item.niveau_confiance !== undefined && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Niveau de confiance</span>
                      <span>{item.niveau_confiance}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          item.niveau_confiance >= 70
                            ? "bg-green-500"
                            : item.niveau_confiance >= 40
                              ? "bg-amber-500"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${item.niveau_confiance}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Source et description */}
                {item.description_source && (
                  <p className="text-sm text-gray-600 mt-2 italic">"{item.description_source}"</p>
                )}

                {/* Notes de modération (transparence) */}
                {item.verification_notes && (
                  <p className="text-xs text-gray-500 mt-2 bg-white/50 p-2 rounded">
                    💬 Note: {item.verification_notes}
                  </p>
                )}

                {/* Corroborations / Contestations */}
                {(item.nb_corroborations > 0 || item.nb_contestations > 0) && (
                  <div className="flex gap-4 mt-2 text-sm">
                    {item.nb_corroborations > 0 && (
                      <span className="text-green-600">
                        👍 {item.nb_corroborations} corroboration
                        {item.nb_corroborations > 1 ? "s" : ""}
                      </span>
                    )}
                    {item.nb_contestations > 0 && (
                      <span className="text-red-600">
                        👎 {item.nb_contestations} contestation
                        {item.nb_contestations > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}

                {/* Appel à contribution si zone grise */}
                {["a_verifier", "incertain", "conteste"].includes(item.statut) && (
                  <div className="mt-3 p-2 bg-white rounded border border-dashed border-amber-400">
                    <p className="text-xs text-amber-700">
                      🔎 <strong>Vous avez des informations ?</strong> Aidez à éclaircir cette zone
                      grise !
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => corroborer(item.id)}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        👍 Je confirme
                      </button>
                      <button
                        onClick={() => contester(item.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        👎 Je conteste
                      </button>
                      <button
                        onClick={() => contribuer(item)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        📎 J'ai une preuve
                      </button>
                    </div>
                  </div>
                )}

                {/* Contributeur */}
                {item.user && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <img
                      src={item.user.avatar_url || "/default-avatar.png"}
                      className="w-4 h-4 rounded-full"
                    />
                    <span>Contribution de {item.user.pseudo}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(!historique || historique.length === 0) && (
        <p className="text-gray-500 text-center py-8">
          Aucune donnée historique disponible pour cette zone.
          <br />
          <a href="#contribuer" className="text-blue-600 underline">
            Contribuez en partageant vos documents !
          </a>
        </p>
      )}
    </div>
  );
}
```

### Système de corroboration / contestation

```jsx
// src/components/zonage/CorroborationButtons.jsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export function useCorroboration() {
  const queryClient = useQueryClient();

  const corroborer = useMutation({
    mutationFn: async ({ contributionId, commentaire }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Vérifier que l'utilisateur n'a pas déjà voté
      const { data: existant } = await supabase
        .from("zonage_votes")
        .select("id")
        .eq("contribution_id", contributionId)
        .eq("user_id", user.id)
        .single();

      if (existant) throw new Error("Vous avez déjà voté sur cette contribution");

      // Enregistrer le vote
      await supabase.from("zonage_votes").insert({
        contribution_id: contributionId,
        user_id: user.id,
        type_vote: "corroboration",
        commentaire,
      });

      // Incrémenter le compteur
      await supabase.rpc("incrementer_corroborations", {
        contribution_id: contributionId,
      });

      // Recalculer le niveau de confiance et potentiellement changer le statut
      await supabase.rpc("recalculer_confiance_contribution", {
        contribution_id: contributionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["historique-zonage"]);
    },
  });

  const contester = useMutation({
    mutationFn: async ({ contributionId, motif }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!motif) throw new Error("Un motif est requis pour contester");

      // Vérifier que l'utilisateur n'a pas déjà voté
      const { data: existant } = await supabase
        .from("zonage_votes")
        .select("id")
        .eq("contribution_id", contributionId)
        .eq("user_id", user.id)
        .single();

      if (existant) throw new Error("Vous avez déjà voté sur cette contribution");

      // Enregistrer la contestation
      await supabase.from("zonage_votes").insert({
        contribution_id: contributionId,
        user_id: user.id,
        type_vote: "contestation",
        commentaire: motif,
      });

      // Incrémenter le compteur
      await supabase.rpc("incrementer_contestations", {
        contribution_id: contributionId,
      });

      // Recalculer et potentiellement passer en statut "conteste"
      await supabase.rpc("recalculer_confiance_contribution", {
        contribution_id: contributionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["historique-zonage"]);
    },
  });

  return { corroborer, contester };
}
```

### Table des votes citoyens

```sql
-- Votes de corroboration/contestation
CREATE TABLE public.zonage_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.zonage_contributions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  type_vote text NOT NULL,                       -- 'corroboration' | 'contestation'
  commentaire text,                              -- Obligatoire pour contestation
  created_at timestamptz DEFAULT now(),

  UNIQUE(contribution_id, user_id)               -- Un seul vote par utilisateur
);

-- Index
CREATE INDEX zonage_votes_contribution_idx ON public.zonage_votes(contribution_id);

-- Fonction pour recalculer la confiance après un vote
CREATE OR REPLACE FUNCTION recalculer_confiance_contribution(p_contribution_id uuid)
RETURNS void AS $$
DECLARE
  v_contribution RECORD;
  v_score integer;
  v_nouveau_statut text;
BEGIN
  SELECT * INTO v_contribution FROM public.zonage_contributions WHERE id = p_contribution_id;

  -- Score de base selon type source
  v_score := CASE v_contribution.type_source
    WHEN 'document_officiel' THEN 60
    WHEN 'acte_notarie' THEN 50
    WHEN 'photo' THEN 35
    WHEN 'temoignage' THEN 20
    ELSE 10
  END;

  -- Bonus pièces jointes
  IF array_length(v_contribution.fichiers_joints, 1) > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Bonus dates précises
  IF v_contribution.date_debut IS NOT NULL AND v_contribution.date_fin IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  -- Impact des votes
  v_score := v_score + (v_contribution.nb_corroborations * 8);
  v_score := v_score - (v_contribution.nb_contestations * 12);

  -- Limiter entre 0 et 100
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Déterminer le nouveau statut si nécessaire
  IF v_contribution.nb_contestations >= 3 AND v_contribution.nb_contestations > v_contribution.nb_corroborations THEN
    v_nouveau_statut := 'conteste';
  ELSIF v_score >= 70 AND v_contribution.statut NOT IN ('officiel', 'verifie') THEN
    v_nouveau_statut := 'probable';  -- Upgrade automatique
  ELSIF v_score < 30 AND v_contribution.statut NOT IN ('rejete', 'conteste') THEN
    v_nouveau_statut := 'incertain';  -- Downgrade automatique
  ELSE
    v_nouveau_statut := v_contribution.statut;
  END IF;

  -- Mise à jour
  UPDATE public.zonage_contributions
  SET
    niveau_confiance = v_score,
    statut = v_nouveau_statut,
    updated_at = now()
  WHERE id = p_contribution_id;
END;
$$ LANGUAGE plpgsql;

-- Fonctions d'incrémentation atomique
CREATE OR REPLACE FUNCTION incrementer_corroborations(p_contribution_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.zonage_contributions
  SET nb_corroborations = nb_corroborations + 1
  WHERE id = p_contribution_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION incrementer_contestations(p_contribution_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.zonage_contributions
  SET nb_contestations = nb_contestations + 1
  WHERE id = p_contribution_id;
END;
$$ LANGUAGE plpgsql;
```

### Affichage du débat sur les zones contestées

```jsx
// src/components/zonage/DebatZonage.jsx
export function DebatZonage({ contributionId }) {
  const { data: votes } = useQuery({
    queryKey: ["zonage-debat", contributionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("zonage_votes")
        .select(
          `
          *,
          user:users(pseudo, avatar_url)
        `
        )
        .eq("contribution_id", contributionId)
        .order("created_at", { ascending: true });
      return data;
    },
  });

  const corroborations = votes?.filter((v) => v.type_vote === "corroboration") || [];
  const contestations = votes?.filter((v) => v.type_vote === "contestation") || [];

  return (
    <div className="space-y-4">
      <h4 className="font-semibold flex items-center gap-2">⚔️ Débat citoyen en cours</h4>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Corroborations */}
        <div className="space-y-2">
          <h5 className="text-green-700 font-medium">👍 Confirmations ({corroborations.length})</h5>
          {corroborations.map((v) => (
            <div key={v.id} className="p-2 bg-green-50 rounded text-sm">
              <div className="flex items-center gap-2">
                <img src={v.user?.avatar_url} className="w-5 h-5 rounded-full" />
                <span className="font-medium">{v.user?.pseudo}</span>
              </div>
              {v.commentaire && <p className="mt-1 text-gray-600">{v.commentaire}</p>}
            </div>
          ))}
        </div>

        {/* Contestations */}
        <div className="space-y-2">
          <h5 className="text-red-700 font-medium">👎 Contestations ({contestations.length})</h5>
          {contestations.map((v) => (
            <div key={v.id} className="p-2 bg-red-50 rounded text-sm">
              <div className="flex items-center gap-2">
                <img src={v.user?.avatar_url} className="w-5 h-5 rounded-full" />
                <span className="font-medium">{v.user?.pseudo}</span>
              </div>
              <p className="mt-1 text-gray-600">{v.commentaire}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        La transparence, c'est montrer les désaccords, pas les cacher.
      </p>
    </div>
  );
}
```

### Gamification et incitations

| Action                                       | Points civiques | Badge                 |
| -------------------------------------------- | --------------- | --------------------- |
| Première contribution validée                | +20 bonus       | 🏅 "Historien local"  |
| 5 contributions validées                     | +50 bonus       | 🎖️ "Archiviste"       |
| Document officiel apporté                    | +50             | -                     |
| Contribution qui révèle un changement A→U    | +100            | 🎯 "Lanceur d'alerte" |
| Contribution corroborée par un autre citoyen | +25             | -                     |
| Corroboration acceptée                       | +5              | -                     |
| Contestation argumentée et pertinente        | +10             | ⚖️ "Fact-checker"     |

### Recommandation

1. **Démarrer la capture immédiatement** sur les communes prioritaires
2. **S'abonner au flux ATOM** pour être notifié en temps réel
3. **Croiser avec le cadastre** pour identifier les propriétaires potentiellement concernés (données
   DVF disponibles sur data.gouv.fr)

## Exploitation des données publiques officielles (JO, DVF, BODACC)

### Sources de données exploitables

| Source                                  | Contenu                                          | Fréquence                  | Accès           |
| --------------------------------------- | ------------------------------------------------ | -------------------------- | --------------- |
| **DVF** (Demandes de Valeurs Foncières) | Mutations immobilières, prix de vente            | Semestriel (avril/octobre) | Open data       |
| **DVF géolocalisé**                     | DVF enrichi avec lat/lng par parcelle            | Semestriel                 | Open data       |
| **BODACC**                              | Annonces légales (ventes, cessions, entreprises) | Quotidien (5x/semaine)     | Open data + API |
| **Hypothèques**                         | Inscriptions hypothécaires                       | Via notaires               | Non open data   |

### DVF - Demandes de Valeurs Foncières

**Quoi** : Toutes les ventes immobilières des 5 dernières années (actes notariés)

**Données clés** :

- `id_parcelle` : Identifiant cadastral (14 caractères)
- `date_mutation` : Date de la vente
- `nature_mutation` : Vente, Adjudication, Expropriation, Échange
- `valeur_fonciere` : Prix de vente
- `latitude`, `longitude` : Coordonnées du centre de parcelle
- `code_commune`, `nom_commune` : Localisation
- `type_local` : Maison, Appartement, Dépendance, Local industriel
- `surface_terrain`, `surface_reelle_bati` : Surfaces

**Téléchargement** :

- Fichier complet :
  `https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/`
- Application interactive : `https://explore.data.gouv.fr/immobilier`

**⚠️ Limitations** :

- Pas l'Alsace-Moselle ni Mayotte
- Pas les noms des acheteurs/vendeurs (données personnelles)
- Mise à jour semestrielle uniquement

### BODACC - Bulletin Officiel des Annonces Civiles et Commerciales

**Quoi** : Annonces légales obligatoires publiées quotidiennement

**Types d'annonces pertinentes** :

| Bulletin     | Contenu                                                      |
| ------------ | ------------------------------------------------------------ |
| **BODACC A** | Ventes et cessions, immatriculations, procédures collectives |
| **BODACC B** | Modifications générales et radiations                        |
| **BODACC C** | Dépôts des comptes annuels                                   |

**API disponible** :
`https://bodacc-datadila.opendatasoft.com/explore/dataset/annonces-commerciales/api/`

**Alertes gratuites** : `https://www.bodacc.fr/` (inscription email)

### Intérêt pour le suivi foncier

| Donnée                 | Utilité                                             | Croisement            |
| ---------------------- | --------------------------------------------------- | --------------------- |
| Vente d'un terrain     | Détecter spéculation sur zone devenue constructible | DVF + zonage GPU      |
| Prix au m²             | Évolution du marché, détection d'anomalies          | DVF + surface terrain |
| Succession             | Changement de propriétaire potentiel                | BODACC civil (limité) |
| Liquidation judiciaire | Biens à venir sur le marché                         | BODACC A              |

### Structure de données pour suivi des mutations

```sql
-- Table des mutations foncières (import DVF)
CREATE TABLE public.mutations_foncieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants DVF
  id_mutation text NOT NULL,
  id_parcelle text NOT NULL,                     -- Référence cadastrale

  -- Localisation
  commune_code text NOT NULL,
  commune_nom text,
  latitude numeric,
  longitude numeric,
  geometry geometry(Point, 4326),

  -- Transaction
  date_mutation date NOT NULL,
  nature_mutation text,                          -- 'Vente', 'Adjudication', etc.
  valeur_fonciere numeric,

  -- Bien
  type_local text,                               -- 'Maison', 'Appartement', 'Terrain'
  surface_terrain numeric,
  surface_bati numeric,
  nombre_pieces integer,

  -- Métadonnées
  source text DEFAULT 'DVF',
  date_import timestamptz DEFAULT now(),

  UNIQUE(id_mutation, id_parcelle)
);

CREATE INDEX mutations_parcelle_idx ON public.mutations_foncieres(id_parcelle);
CREATE INDEX mutations_commune_idx ON public.mutations_foncieres(commune_code);
CREATE INDEX mutations_date_idx ON public.mutations_foncieres(date_mutation);
CREATE INDEX mutations_geom_idx ON public.mutations_foncieres USING GIST (geometry);

-- Vue pour détecter les ventes suspectes après changement de zonage
CREATE VIEW public.v_ventes_apres_changement_zonage AS
SELECT
  m.*,
  a.ancien_zonage,
  a.nouveau_zonage,
  a.date_changement,
  m.date_mutation - a.date_changement::date AS jours_apres_changement,
  m.valeur_fonciere / NULLIF(m.surface_terrain, 0) AS prix_m2
FROM public.mutations_foncieres m
JOIN public.alertes_zonage a ON m.id_parcelle = a.parcelle_id
WHERE a.devient_constructible = true
  AND m.date_mutation > a.date_changement::date
ORDER BY m.date_mutation DESC;
```

### Script d'import DVF

```javascript
// scripts/import-dvf.js
import { parse } from "csv-parse/sync";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createClient } from "@supabase/supabase-js";

const DVF_URL = "https://www.data.gouv.fr/api/1/datasets/r/d7933994-2c66-4131-a4da-cf7cd18040a4";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Communes à importer (filtrer pour ne pas tout charger)
const COMMUNES_CIBLES = ["2B096", "2A004", "2B033"]; // Corte, Ajaccio, Bastia

export async function importDVF() {
  console.log("📥 Téléchargement du fichier DVF géolocalisé...");

  const response = await fetch(DVF_URL);
  const buffer = await response.arrayBuffer();

  // Décompresser et parser
  const gunzip = createGunzip();
  const decompressed = await new Promise((resolve, reject) => {
    const chunks = [];
    gunzip.on("data", (chunk) => chunks.push(chunk));
    gunzip.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    gunzip.on("error", reject);
    gunzip.write(Buffer.from(buffer));
    gunzip.end();
  });

  const records = parse(decompressed, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ",",
  });

  console.log(`📊 ${records.length} lignes trouvées`);

  // Filtrer par communes cibles
  const filtered = records.filter((r) => COMMUNES_CIBLES.includes(r.code_commune));

  console.log(`🎯 ${filtered.length} lignes pour les communes cibles`);

  // Préparer les données pour insertion
  const mutations = filtered.map((r) => ({
    id_mutation: r.id_mutation,
    id_parcelle: r.id_parcelle,
    commune_code: r.code_commune,
    commune_nom: r.nom_commune,
    latitude: r.latitude ? parseFloat(r.latitude) : null,
    longitude: r.longitude ? parseFloat(r.longitude) : null,
    geometry: r.latitude && r.longitude ? `SRID=4326;POINT(${r.longitude} ${r.latitude})` : null,
    date_mutation: r.date_mutation,
    nature_mutation: r.nature_mutation,
    valeur_fonciere: r.valeur_fonciere ? parseFloat(r.valeur_fonciere) : null,
    type_local: r.type_local,
    surface_terrain: r.surface_terrain ? parseFloat(r.surface_terrain) : null,
    surface_bati: r.surface_reelle_bati ? parseFloat(r.surface_reelle_bati) : null,
    nombre_pieces: r.nombre_pieces_principales ? parseInt(r.nombre_pieces_principales) : null,
  }));

  // Insertion par batch
  const batchSize = 500;
  for (let i = 0; i < mutations.length; i += batchSize) {
    const batch = mutations.slice(i, i + batchSize);
    const { error } = await supabase.from("mutations_foncieres").upsert(batch, {
      onConflict: "id_mutation,id_parcelle",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`Erreur batch ${i}:`, error);
    } else {
      console.log(`  ✅ Batch ${i}-${i + batchSize} importé`);
    }
  }

  console.log("✅ Import DVF terminé");
}
```

### Surveillance BODACC via API

```javascript
// scripts/watch-bodacc.js

const BODACC_API = "https://bodacc-datadila.opendatasoft.com/api/records/1.0/search/";

// Surveiller les ventes et cessions dans les communes cibles
export async function checkBodaccAnnonces(communesCodes) {
  const params = new URLSearchParams({
    dataset: "annonces-commerciales",
    rows: 100,
    sort: "-dateparution",
    refine: {
      typeavis: "Vente/Cession",
    },
  });

  const response = await fetch(`${BODACC_API}?${params}`);
  const data = await response.json();

  const annonces = [];

  for (const record of data.records) {
    const fields = record.fields;

    // Vérifier si c'est dans nos communes (via adresse)
    const adresse = fields.adresse || "";
    const isRelevant = communesCodes.some((code) => {
      // Matcher par code postal ou nom de commune
      return (
        adresse.includes(code) ||
        fields.ville?.toUpperCase().includes("CORTE") ||
        fields.ville?.toUpperCase().includes("BASTIA")
      );
    });

    if (isRelevant) {
      annonces.push({
        id: fields.id,
        type: fields.typeavis,
        date: fields.dateparution,
        entreprise: fields.denomination,
        adresse: fields.adresse,
        description: fields.descriptif,
        tribunal: fields.tribunal,
        url: `https://www.bodacc.fr/annonce/detail/${fields.id}`,
      });
    }
  }

  return annonces;
}

// S'abonner aux alertes BODACC (via leur service email gratuit)
// Alternative : créer un webhook avec leur API pour notifications push
```

### Composant d'affichage des mutations

```jsx
// src/components/map/MutationsLayer.jsx
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, Popup } from "react-leaflet";
import { supabase } from "@/lib/supabase";

export function MutationsLayer({ communeCode, annees = 2 }) {
  const { data: mutations } = useQuery({
    queryKey: ["mutations", communeCode, annees],
    queryFn: async () => {
      const dateMin = new Date();
      dateMin.setFullYear(dateMin.getFullYear() - annees);

      const { data } = await supabase
        .from("mutations_foncieres")
        .select("*")
        .eq("commune_code", communeCode)
        .gte("date_mutation", dateMin.toISOString().split("T")[0])
        .not("latitude", "is", null);

      return data;
    },
  });

  // Couleur selon le prix au m²
  const getColor = (prixM2) => {
    if (!prixM2) return "#gray";
    if (prixM2 < 50) return "#22c55e"; // Vert - bon marché
    if (prixM2 < 150) return "#eab308"; // Jaune - moyen
    if (prixM2 < 300) return "#f97316"; // Orange - cher
    return "#ef4444"; // Rouge - très cher
  };

  return (
    <>
      {mutations?.map((m) => {
        const prixM2 = m.surface_terrain > 0 ? m.valeur_fonciere / m.surface_terrain : null;

        return (
          <CircleMarker
            key={m.id}
            center={[m.latitude, m.longitude]}
            radius={8}
            pathOptions={{
              color: getColor(prixM2),
              fillColor: getColor(prixM2),
              fillOpacity: 0.6,
            }}
          >
            <Popup>
              <div className="space-y-2">
                <div className="font-bold">
                  {m.nature_mutation} - {m.type_local || "Terrain"}
                </div>
                <div className="text-lg font-semibold text-blue-600">
                  {m.valeur_fonciere?.toLocaleString("fr-FR")} €
                </div>
                <div className="text-sm text-gray-600">
                  <div>📅 {new Date(m.date_mutation).toLocaleDateString("fr-FR")}</div>
                  {m.surface_terrain && (
                    <div>📐 Terrain: {m.surface_terrain.toLocaleString("fr-FR")} m²</div>
                  )}
                  {m.surface_bati && (
                    <div>🏠 Bâti: {m.surface_bati.toLocaleString("fr-FR")} m²</div>
                  )}
                  {prixM2 && (
                    <div className="font-medium">💰 {prixM2.toFixed(0)} €/m² (terrain)</div>
                  )}
                </div>
                <div className="text-xs text-gray-400">Parcelle: {m.id_parcelle}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
```

### Alerte : vente après changement de zonage

```jsx
// src/components/admin/VentesSuspectes.jsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function VentesSuspectes() {
  const { data: ventes } = useQuery({
    queryKey: ["ventes-apres-changement"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_ventes_apres_changement_zonage")
        .select("*")
        .order("jours_apres_changement", { ascending: true })
        .limit(50);
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        🔍 Ventes après changement de zonage
      </h2>

      <p className="text-sm text-gray-600">
        Parcelles vendues peu après être devenues constructibles. Peut indiquer une information
        privilégiée ou une spéculation.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Parcelle</th>
              <th className="px-3 py-2 text-left">Changement</th>
              <th className="px-3 py-2 text-left">Délai vente</th>
              <th className="px-3 py-2 text-right">Prix</th>
              <th className="px-3 py-2 text-right">€/m²</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ventes?.map((v) => (
              <tr
                key={v.id}
                className={
                  v.jours_apres_changement < 90
                    ? "bg-red-50"
                    : v.jours_apres_changement < 180
                      ? "bg-amber-50"
                      : ""
                }
              >
                <td className="px-3 py-2 font-mono text-xs">{v.id_parcelle}</td>
                <td className="px-3 py-2">
                  <span className="text-red-600">{v.ancien_zonage}</span>
                  <span className="mx-1">→</span>
                  <span className="text-green-600">{v.nouveau_zonage}</span>
                </td>
                <td className="px-3 py-2">
                  {v.jours_apres_changement < 30 && "🚨 "}
                  {v.jours_apres_changement} jours
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {v.valeur_fonciere?.toLocaleString("fr-FR")} €
                </td>
                <td className="px-3 py-2 text-right">{v.prix_m2?.toFixed(0)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        💡 Une vente dans les 90 jours suivant un changement de zonage mérite une attention
        particulière.
      </div>
    </div>
  );
}
```

### Croisement avec les contributions citoyennes

```sql
-- Vue enrichie : historique complet d'une parcelle
CREATE VIEW public.v_historique_parcelle AS
SELECT
  p.id_parcelle,
  p.commune_code,

  -- Dernière mutation connue
  m.date_mutation AS derniere_vente,
  m.valeur_fonciere AS dernier_prix,
  m.nature_mutation,

  -- Zonage actuel (GPU)
  z.typezone AS zonage_actuel,
  z.libelle AS libelle_zonage,

  -- Alertes de changement
  a.ancien_zonage,
  a.nouveau_zonage,
  a.date_changement,
  a.devient_constructible,

  -- Contributions citoyennes sur l'historique
  (SELECT json_agg(json_build_object(
    'zonage', c.zonage_declare,
    'periode', COALESCE(c.periode_estimee, c.date_debut::text || ' - ' || c.date_fin::text),
    'confiance', c.niveau_confiance,
    'statut', c.statut
  ))
  FROM public.zonage_contributions c
  WHERE ST_Intersects(c.geometry, p.geometry)
    AND c.statut NOT IN ('en_attente', 'rejete')
  ) AS historique_citoyen

FROM (SELECT DISTINCT id_parcelle, commune_code, geometry FROM public.mutations_foncieres WHERE geometry IS NOT NULL) p
LEFT JOIN LATERAL (
  SELECT * FROM public.mutations_foncieres mf
  WHERE mf.id_parcelle = p.id_parcelle
  ORDER BY date_mutation DESC LIMIT 1
) m ON true
LEFT JOIN public.zonage_historique z ON z.commune_code = p.commune_code
LEFT JOIN public.alertes_zonage a ON a.parcelle_id = p.id_parcelle;
```

### Récapitulatif des sources officielles

| Source              | API               | Mise à jour | Données clés                  | Usage                   |
| ------------------- | ----------------- | ----------- | ----------------------------- | ----------------------- |
| **DVF géolocalisé** | Téléchargement    | Semestriel  | Prix, parcelle, date, surface | Suivi des transactions  |
| **BODACC API**      | REST OpenDataSoft | Quotidien   | Annonces légales, entreprises | Alertes ventes/cessions |
| **GPU ATOM**        | RSS/Atom          | Continu     | Zonages PLU                   | Détection changements   |
| **Cadastre WFS**    | OGC WFS           | Mensuel     | Parcelles, bâtiments          | Cartographie            |

### ⚠️ Respect de la vie privée

Les données DVF sont anonymisées mais permettent quand même :

- ❌ Pas les noms des acheteurs/vendeurs
- ❌ Pas d'indexation par moteurs de recherche (CGU)
- ✅ Analyse statistique du marché
- ✅ Détection d'anomalies de prix
- ✅ Croisement avec zonage (données publiques)

> **Important** : Ne jamais afficher publiquement l'historique complet d'une parcelle avec les prix
> de vente sans précaution. Privilégier les statistiques agrégées.

---

## Couches de transparence citoyenne

Pour une transparence maximale, nous intégrons plusieurs sources de données publiques permettant aux
citoyens de surveiller l'action publique sur leur territoire.

### 1. Géorisques - Risques environnementaux

Sources disponibles via l'API Géorisques (`https://georisques.gouv.fr/api/`):

| Couche          | Description                                     | Intérêt transparence      |
| --------------- | ----------------------------------------------- | ------------------------- |
| **ICPE**        | Installations Classées Protection Environnement | Usines polluantes, Seveso |
| **SIS**         | Secteurs d'Information sur les Sols             | Sols pollués              |
| **CASIAS**      | Anciens sites industriels                       | Historique pollution      |
| **BDHI**        | Inondations historiques                         | Risque inondation         |
| **BDMvt**       | Mouvements de terrain                           | Glissements, éboulements  |
| **Cavités**     | Inventaire cavités souterraines                 | Risque effondrement       |
| **Argiles RGA** | Retrait-gonflement argiles                      | Risque construction       |
| **TRI**         | Territoires Risque Inondation                   | Zones inondables          |

#### Import des ICPE géolocalisées

```javascript
// scripts/import-icpe.js
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function importICPE() {
  // GeoJSON disponible sur data.gouv.fr
  const geojsonUrl =
    "https://www.data.gouv.fr/api/1/datasets/r/8e69955f-05d0-4e5e-8cbe-7d19acc303c1";

  const response = await fetch(geojsonUrl);
  const geojson = await response.json();

  console.log(`📍 Import de ${geojson.features.length} installations ICPE...`);

  for (const feature of geojson.features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    await supabase.from("icpe").upsert(
      {
        code_aiot: props.code_aiot,
        nom_etablissement: props.nom_ets,
        raison_sociale: props.raison_sociale,
        code_insee: props.code_insee,
        commune: props.commune,
        adresse: props.adresse,
        regime: props.regime, // 'A' (autorisation), 'E' (enregistrement), 'D' (déclaration)
        seveso: props.seveso, // 'SH' (seuil haut), 'SB' (seuil bas), null
        etat_activite: props.etat_activite,
        latitude: lat,
        longitude: lng,
        geometry: `POINT(${lng} ${lat})`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code_aiot" }
    );
  }

  console.log("✅ Import ICPE terminé");
}

importICPE().catch(console.error);
```

#### Schéma SQL risques environnementaux

```sql
-- Table ICPE
CREATE TABLE public.icpe (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_aiot text UNIQUE NOT NULL,
  nom_etablissement text,
  raison_sociale text,
  code_insee text,
  commune text,
  adresse text,
  regime text CHECK (regime IN ('A', 'E', 'D')), -- Autorisation/Enregistrement/Déclaration
  seveso text CHECK (seveso IN ('SH', 'SB', NULL)), -- Seuil Haut/Bas
  etat_activite text,
  latitude double precision,
  longitude double precision,
  geometry geometry(Point, 4326),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table Sols pollués (SIS + CASIAS)
CREATE TABLE public.sols_pollues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('SIS', 'CASIAS', 'BASOL')),
  identifiant text UNIQUE,
  nom_site text,
  code_insee text,
  commune text,
  adresse text,
  type_pollution text,
  etat text, -- 'en_cours', 'traite', 'surveille'
  restrictions_usage text,
  geometry geometry(Geometry, 4326),
  created_at timestamptz DEFAULT now()
);

-- Index spatiaux
CREATE INDEX idx_icpe_geom ON public.icpe USING GIST(geometry);
CREATE INDEX idx_sols_pollues_geom ON public.sols_pollues USING GIST(geometry);
CREATE INDEX idx_icpe_seveso ON public.icpe(seveso) WHERE seveso IS NOT NULL;
```

#### Composant couche risques

```jsx
// src/components/gis/RisquesLayer.jsx
import { useEffect, useState } from "react";
import { LayerGroup, Marker, Popup, Circle } from "react-leaflet";
import { supabase } from "@/lib/supabase";

const ICPE_COLORS = {
  SH: "#dc2626", // Seveso Seuil Haut = Rouge
  SB: "#f97316", // Seveso Seuil Bas = Orange
  A: "#eab308", // Autorisation = Jaune
  E: "#22c55e", // Enregistrement = Vert
  D: "#3b82f6", // Déclaration = Bleu
};

export function RisquesLayer({ commune, showICPE = true, showSolsPollues = true }) {
  const [icpe, setIcpe] = useState([]);
  const [sols, setSols] = useState([]);

  useEffect(() => {
    if (showICPE) loadICPE();
    if (showSolsPollues) loadSols();
  }, [commune, showICPE, showSolsPollues]);

  async function loadICPE() {
    const { data } = await supabase.from("icpe").select("*").eq("code_insee", commune);
    setIcpe(data || []);
  }

  async function loadSols() {
    const { data } = await supabase.from("sols_pollues").select("*").eq("code_insee", commune);
    setSols(data || []);
  }

  return (
    <LayerGroup>
      {/* ICPE avec code couleur risque */}
      {icpe.map((site) => (
        <Marker
          key={site.code_aiot}
          position={[site.latitude, site.longitude]}
          icon={createICPEIcon(site.seveso || site.regime)}
        >
          <Popup>
            <div className="p-2">
              <h4 className="font-bold">{site.nom_etablissement}</h4>
              <p className="text-sm text-gray-600">{site.raison_sociale}</p>
              {site.seveso && (
                <span className={`badge ${site.seveso === "SH" ? "bg-red-500" : "bg-orange-500"}`}>
                  ⚠️ Seveso {site.seveso === "SH" ? "Seuil Haut" : "Seuil Bas"}
                </span>
              )}
              <p className="text-xs mt-2">{site.adresse}</p>
              <a
                href={`https://www.georisques.gouv.fr/risques/installations/donnees/details/${site.code_aiot}`}
                target="_blank"
                className="text-blue-600 text-xs"
              >
                Fiche Géorisques →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Sols pollués avec zone tampon */}
      {sols.map((site) => (
        <Circle
          key={site.identifiant}
          center={getCenter(site.geometry)}
          radius={100}
          pathOptions={{ color: "#7c3aed", fillColor: "#a78bfa", fillOpacity: 0.3 }}
        >
          <Popup>
            <h4 className="font-bold">{site.nom_site}</h4>
            <p className="text-sm">{site.type_pollution}</p>
            {site.restrictions_usage && (
              <p className="text-red-600 text-xs">⚠️ {site.restrictions_usage}</p>
            )}
          </Popup>
        </Circle>
      ))}
    </LayerGroup>
  );
}
```

### 2. Marchés publics - DECP

Les Données Essentielles de la Commande Publique permettent de suivre les marchés attribués par les
collectivités.

#### Source et API

```javascript
// scripts/import-decp.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Fichier consolidé mensuel
const DECP_URL = "https://www.data.gouv.fr/api/1/datasets/r/d00a6a5a-beef-442e-8aee-5867f47a87d0"; // 2025

async function importDECP(codeInseeList) {
  console.log("📦 Téléchargement DECP consolidé...");
  const response = await fetch(DECP_URL);
  const data = await response.json();

  // Filtrer par communes surveillées
  const marchesLocaux =
    data.marches?.filter(
      (m) => codeInseeList.includes(m.acheteur?.id?.slice(0, 5)) // SIREN commence par code INSEE
    ) || [];

  console.log(`📋 ${marchesLocaux.length} marchés pour les communes surveillées`);

  for (const marche of marchesLocaux) {
    await supabase.from("marches_publics").upsert(
      {
        id_marche: marche.id,
        acheteur_id: marche.acheteur?.id,
        acheteur_nom: marche.acheteur?.nom,
        nature: marche.nature, // 'Marché', 'Accord-cadre'
        objet: marche.objet,
        code_cpv: marche.codeCPV,
        procedure: marche.procedure,
        lieu_execution: marche.lieuExecution?.code,
        duree_mois: marche.dureeMois,
        date_notification: marche.dateNotification,
        date_publication: marche.datePublicationDonnees,
        montant_ht: marche.montant,
        forme_prix: marche.formePrix,
        titulaires: marche.titulaires,
        modifications: marche.modifications,
      },
      { onConflict: "id_marche" }
    );
  }

  console.log("✅ Import DECP terminé");
}
```

#### Schéma SQL marchés publics

```sql
CREATE TABLE public.marches_publics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  id_marche text UNIQUE NOT NULL,
  acheteur_id text,
  acheteur_nom text,
  nature text, -- 'Marché', 'Accord-cadre', 'Marché subséquent'
  objet text,
  code_cpv text, -- Classification des marchés
  procedure text, -- 'Appel d'offres ouvert', 'Procédure adaptée'...
  lieu_execution text, -- Code INSEE
  duree_mois integer,
  date_notification date,
  date_publication date,
  montant_ht numeric(15,2),
  forme_prix text,
  titulaires jsonb, -- [{id, nom, typeIdentifiant}]
  modifications jsonb, -- Avenants
  created_at timestamptz DEFAULT now()
);

-- Statistiques marchés par collectivité
CREATE VIEW public.v_stats_marches AS
SELECT
  acheteur_id,
  acheteur_nom,
  EXTRACT(YEAR FROM date_notification) AS annee,
  COUNT(*) AS nb_marches,
  SUM(montant_ht) AS montant_total,
  AVG(montant_ht) AS montant_moyen,
  COUNT(DISTINCT (titulaires->0->>'id')) AS nb_titulaires_uniques
FROM public.marches_publics
GROUP BY acheteur_id, acheteur_nom, EXTRACT(YEAR FROM date_notification);

-- Détection concentration titulaires
CREATE VIEW public.v_concentration_titulaires AS
WITH titulaires_expands AS (
  SELECT
    acheteur_nom,
    EXTRACT(YEAR FROM date_notification) AS annee,
    jsonb_array_elements(titulaires)->>'id' AS titulaire_id,
    jsonb_array_elements(titulaires)->>'nom' AS titulaire_nom,
    montant_ht
  FROM public.marches_publics
  WHERE titulaires IS NOT NULL
)
SELECT
  acheteur_nom,
  annee,
  titulaire_nom,
  COUNT(*) AS nb_marches,
  SUM(montant_ht) AS montant_total,
  ROUND(100.0 * SUM(montant_ht) / SUM(SUM(montant_ht)) OVER (PARTITION BY acheteur_nom, annee), 1) AS pct_montant
FROM titulaires_expands
GROUP BY acheteur_nom, annee, titulaire_id, titulaire_nom
HAVING COUNT(*) > 2
ORDER BY pct_montant DESC;
```

#### Composant visualisation marchés

```jsx
// src/components/gis/MarchesPublicsLayer.jsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function MarchesPublicsPanel({ communeCode }) {
  const [stats, setStats] = useState(null);
  const [concentration, setConcentration] = useState([]);

  useEffect(() => {
    loadStats();
    loadConcentration();
  }, [communeCode]);

  async function loadStats() {
    const { data } = await supabase
      .from("v_stats_marches")
      .select("*")
      .ilike("acheteur_id", `${communeCode}%`)
      .order("annee", { ascending: false });
    setStats(data);
  }

  async function loadConcentration() {
    const { data } = await supabase
      .from("v_concentration_titulaires")
      .select("*")
      .order("pct_montant", { ascending: false })
      .limit(10);
    setConcentration(data);
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-bold mb-4">📋 Marchés publics</h3>

      {/* Stats annuelles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats?.slice(0, 3).map((s) => (
          <div key={s.annee} className="p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold">{s.nb_marches}</div>
            <div className="text-sm text-gray-600">{s.annee}</div>
            <div className="text-xs">{(s.montant_total / 1000000).toFixed(1)} M€</div>
          </div>
        ))}
      </div>

      {/* Alerte concentration */}
      {concentration.filter((c) => c.pct_montant > 30).length > 0 && (
        <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 mb-4">
          <h4 className="font-bold text-yellow-800">⚠️ Concentration détectée</h4>
          {concentration
            .filter((c) => c.pct_montant > 30)
            .map((c) => (
              <p key={c.titulaire_nom} className="text-sm">
                <strong>{c.titulaire_nom}</strong> : {c.pct_montant}% des marchés ({c.nb_marches}{" "}
                contrats)
              </p>
            ))}
        </div>
      )}

      {/* Top titulaires */}
      <h4 className="font-semibold mb-2">Principaux attributaires</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Entreprise</th>
            <th className="text-right p-2">Marchés</th>
            <th className="text-right p-2">Montant</th>
            <th className="text-right p-2">%</th>
          </tr>
        </thead>
        <tbody>
          {concentration.slice(0, 5).map((c) => (
            <tr key={c.titulaire_nom} className="border-b">
              <td className="p-2">{c.titulaire_nom}</td>
              <td className="text-right p-2">{c.nb_marches}</td>
              <td className="text-right p-2">{(c.montant_total / 1000).toFixed(0)} k€</td>
              <td className="text-right p-2 font-bold">{c.pct_montant}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Permis de construire - Sitadel

Suivi des autorisations d'urbanisme depuis 2013.

```javascript
// scripts/import-sitadel.js
// Source: https://www.statistiques.developpement-durable.gouv.fr/donnees-des-permis-de-construire-et-autres-autorisations-durbanisme

async function importSitadel(codeInseeList) {
  // API DIDO du SDES
  const baseUrl = "https://data.statistiques.developpement-durable.gouv.fr";

  for (const codeInsee of codeInseeList) {
    const response = await fetch(
      `${baseUrl}/dido/api/v1/datasets/logements-autorises/records?limit=1000&where=code_commune='${codeInsee}'`
    );

    const data = await response.json();

    for (const record of data.results || []) {
      await supabase.from("permis_construire").upsert(
        {
          numero_pc: record.numero,
          type_autorisation: record.type, // 'PC', 'DP', 'PA', 'PD'
          code_insee: record.code_commune,
          date_depot: record.date_depot,
          date_autorisation: record.date_autorisation,
          date_chantier: record.date_chantier,
          date_achevement: record.date_achevement,
          etat: record.etat, // 'autorise', 'commence', 'acheve', 'annule'
          nb_logements: record.nb_logements,
          surface_plancher: record.surface_plancher,
          nature_projet: record.nature_projet,
          categorie_construction: record.categorie_construction,
        },
        { onConflict: "numero_pc" }
      );
    }
  }
}
```

#### Schéma SQL permis

```sql
CREATE TABLE public.permis_construire (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_pc text UNIQUE NOT NULL,
  type_autorisation text CHECK (type_autorisation IN ('PC', 'DP', 'PA', 'PD')),
  code_insee text,
  date_depot date,
  date_autorisation date,
  date_chantier date,
  date_achevement date,
  etat text,
  nb_logements integer,
  surface_plancher numeric(10,2),
  nature_projet text,
  categorie_construction text,
  -- Géolocalisation (si disponible)
  latitude double precision,
  longitude double precision,
  geometry geometry(Point, 4326),
  created_at timestamptz DEFAULT now()
);

-- Statistiques construction
CREATE VIEW public.v_stats_construction AS
SELECT
  code_insee,
  EXTRACT(YEAR FROM date_autorisation) AS annee,
  type_autorisation,
  COUNT(*) AS nb_permis,
  SUM(nb_logements) AS total_logements,
  SUM(surface_plancher) AS total_surface
FROM public.permis_construire
WHERE etat != 'annule'
GROUP BY code_insee, EXTRACT(YEAR FROM date_autorisation), type_autorisation;
```

### 4. Déclarations des élus - HATVP

Transparence sur le patrimoine et les intérêts des élus locaux.

```javascript
// scripts/sync-hatvp.js
async function syncHATVP() {
  // Liste CSV des déclarations publiées
  const listeCsv = await fetch("https://www.hatvp.fr/livraison/opendata/liste.csv");
  const declarations = parseCsv(await listeCsv.text());

  // Filtrer élus locaux (maires, adjoints, conseillers régionaux...)
  const elusLocaux = declarations.filter((d) =>
    ["Maire", "Adjoint", "Conseiller régional", "Conseiller départemental"].some((m) =>
      d.mandat?.includes(m)
    )
  );

  for (const elu of elusLocaux) {
    await supabase.from("declarations_elus").upsert(
      {
        id_declaration: elu.id,
        nom: elu.nom,
        prenom: elu.prenom,
        mandat: elu.mandat,
        collectivite: elu.organisme,
        type_declaration: elu.type, // 'patrimoine', 'interets', 'variation'
        date_publication: elu.date_publication,
        url_declaration: `https://www.hatvp.fr/consulter-les-declarations/?id=${elu.id}`,
        appreciation: elu.appreciation, // Avis de la HATVP
      },
      { onConflict: "id_declaration" }
    );
  }
}
```

### 5. Délibérations du conseil municipal

Scraping des actes officiels publiés par les collectivités.

```javascript
// scripts/scrape-deliberations.js
import * as cheerio from "cheerio";

async function scrapeDeliberationsCorte() {
  // Exemple: page des délibérations de Corte
  const url = "https://www.corte.corsica/deliberations/"; // URL fictive

  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const deliberations = [];

  $(".deliberation-item").each((i, el) => {
    deliberations.push({
      date: $(el).find(".date").text().trim(),
      numero: $(el).find(".numero").text().trim(),
      objet: $(el).find(".objet").text().trim(),
      url_pdf: $(el).find("a.pdf").attr("href"),
      vote: $(el).find(".vote").text().trim(), // 'unanimité', 'majorité'...
    });
  });

  // Stockage
  for (const delib of deliberations) {
    await supabase.from("deliberations").upsert(
      {
        commune_code: "2B096", // Corte
        date_seance: parseDate(delib.date),
        numero: delib.numero,
        objet: delib.objet,
        url_document: delib.url_pdf,
        vote: delib.vote,
        // Extraction thématique par IA
        themes: await extractThemes(delib.objet),
      },
      { onConflict: ["commune_code", "numero"] }
    );
  }
}

async function extractThemes(objet) {
  // Classification simple par mots-clés
  const themes = [];
  if (/urbanis|PLU|zonage|permis/i.test(objet)) themes.push("urbanisme");
  if (/march|appel|attribu/i.test(objet)) themes.push("marches_publics");
  if (/budget|fiscal|taxe/i.test(objet)) themes.push("finances");
  if (/environnement|eau|déchet/i.test(objet)) themes.push("environnement");
  if (/social|logement|aide/i.test(objet)) themes.push("social");
  return themes;
}
```

### 6. Répertoire National des Élus

```sql
-- Table des élus (depuis data.gouv.fr)
CREATE TABLE public.elus (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  prenom text,
  sexe text,
  date_naissance date,
  profession text,

  -- Mandat actuel
  mandat text, -- 'Maire', 'Adjoint', 'Conseiller municipal'...
  code_insee text,
  commune text,
  date_debut_mandat date,
  date_fin_mandat date,

  -- Cumul (historique)
  autres_mandats jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vue élus avec cumul
CREATE VIEW public.v_elus_mandats AS
SELECT
  e.*,
  d.url_declaration AS declaration_hatvp,
  d.appreciation AS appreciation_hatvp,
  jsonb_array_length(e.autres_mandats) AS nb_mandats_cumul
FROM public.elus e
LEFT JOIN public.declarations_elus d ON d.nom = e.nom AND d.prenom = e.prenom;
```

### Tableau de bord transparence

```jsx
// src/components/gis/TransparencyDashboard.jsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function TransparencyDashboard({ communeCode }) {
  const [data, setData] = useState({
    elus: [],
    marches: null,
    deliberations: [],
    risques: { icpe: 0, seveso: 0, solsPollues: 0 },
    permis: null,
  });

  useEffect(() => {
    Promise.all([
      loadElus(),
      loadMarchesStats(),
      loadDeliberations(),
      loadRisquesStats(),
      loadPermisStats(),
    ]).then(([elus, marches, deliberations, risques, permis]) => {
      setData({ elus, marches, deliberations, risques, permis });
    });
  }, [communeCode]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {/* Card Élus */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold mb-2">👥 Élus</h3>
        <div className="text-3xl font-bold">{data.elus.length}</div>
        <div className="text-sm text-gray-600">
          {data.elus.filter((e) => e.declaration_hatvp).length} déclarations HATVP
        </div>
        <div className="mt-2">
          {data.elus.slice(0, 3).map((e) => (
            <div key={e.id} className="text-sm">
              {e.prenom} {e.nom} - {e.mandat}
            </div>
          ))}
        </div>
      </div>

      {/* Card Marchés */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold mb-2">📋 Marchés publics</h3>
        <div className="text-3xl font-bold">{data.marches?.nb_marches || 0}</div>
        <div className="text-sm text-gray-600">
          {((data.marches?.montant_total || 0) / 1000000).toFixed(1)} M€ cette année
        </div>
      </div>

      {/* Card Risques */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold mb-2">⚠️ Risques industriels</h3>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>ICPE</span>
            <span className="font-bold">{data.risques.icpe}</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Dont Seveso</span>
            <span className="font-bold">{data.risques.seveso}</span>
          </div>
          <div className="flex justify-between text-purple-600">
            <span>Sols pollués</span>
            <span className="font-bold">{data.risques.solsPollues}</span>
          </div>
        </div>
      </div>

      {/* Card Urbanisme */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold mb-2">🏗️ Construction</h3>
        <div className="text-3xl font-bold">{data.permis?.nb_permis || 0}</div>
        <div className="text-sm text-gray-600">
          {data.permis?.total_logements || 0} logements autorisés
        </div>
        <div className="text-xs text-gray-500">
          {data.permis?.total_surface || 0} m² de surface plancher
        </div>
      </div>

      {/* Card Délibérations récentes */}
      <div className="bg-white rounded-lg shadow p-4 col-span-2">
        <h3 className="text-lg font-bold mb-2">📜 Dernières délibérations</h3>
        <div className="space-y-2">
          {data.deliberations.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{formatDate(d.date_seance)}</span>
              <span className="flex-1 truncate">{d.objet}</span>
              {d.themes?.map((t) => (
                <span key={t} className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                  {t}
                </span>
              ))}
              {d.url_document && (
                <a href={d.url_document} target="_blank" className="text-blue-600">
                  PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Récapitulatif des sources de transparence

| Source              | Fréquence MàJ | API/Format  | Données clés            |
| ------------------- | ------------- | ----------- | ----------------------- |
| **Géorisques ICPE** | Annuel        | GeoJSON     | Usines classées, Seveso |
| **Géorisques SIS**  | Continu       | CSV/JSON    | Sols pollués            |
| **DECP**            | Mensuel       | JSON 800Mo  | Marchés >40k€           |
| **Sitadel**         | Mensuel       | API DIDO    | Permis construire       |
| **HATVP**           | Continu       | CSV/XML     | Déclarations élus       |
| **RNE**             | Hebdomadaire  | CSV         | Liste élus              |
| **DVF**             | Semestriel    | CSV/GeoJSON | Ventes immobilières     |
| **BODACC**          | Quotidien     | API         | Annonces légales        |
| **GPU**             | Continu       | ATOM/WFS    | Zonages PLU             |

---

## Sources open data additionnelles

### 7. Hub'Eau - Données environnementales sur l'eau

Hub'Eau (`https://hubeau.eaufrance.fr`) offre **13 API REST gratuites** sur l'eau :

| API                     | Données                  | Volume           |
| ----------------------- | ------------------------ | ---------------- |
| **Qualité eau potable** | Analyses ARS par commune | 120M analyses    |
| **Qualité cours d'eau** | Polluants, pesticides    | Continu          |
| **Qualité nappes**      | Eaux souterraines        | Continu          |
| **Hydrométrie**         | Débit, hauteur rivières  | Temps réel       |
| **Piézométrie**         | Niveau nappes            | Temps réel       |
| **Température**         | Température cours d'eau  | Continu          |
| **Prélèvements**        | Volumes prélevés         | 1.1M/an          |
| **Poisson**             | Inventaires piscicoles   | Continu          |
| **PPP**                 | Ventes phytosanitaires   | 32M transactions |
| **Écoulement**          | Observations assecs      | 350k obs         |

#### Intégration qualité eau potable

```javascript
// scripts/sync-hubeau-potable.js
const HUBEAU_BASE = "https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable";

async function syncQualiteEauPotable(codeInsee) {
  // Derniers résultats d'analyse pour la commune
  const response = await fetch(
    `${HUBEAU_BASE}/resultats_dis?code_commune=${codeInsee}&size=1000&sort=desc`
  );
  const data = await response.json();

  for (const analyse of data.data || []) {
    await supabase.from("qualite_eau").upsert(
      {
        code_commune: codeInsee,
        code_reseau: analyse.code_reseau,
        nom_reseau: analyse.nom_reseau,
        date_prelevement: analyse.date_prelevement,
        parametre_code: analyse.code_parametre,
        parametre_nom: analyse.libelle_parametre,
        resultat_numerique: analyse.resultat_numerique,
        unite: analyse.libelle_unite,
        limite_qualite: analyse.limite_qualite_parametre,
        reference_qualite: analyse.reference_qualite_parametre,
        conformite: analyse.conclusion_conformite_prelevement,
      },
      { onConflict: ["code_reseau", "date_prelevement", "parametre_code"] }
    );
  }
}

// Stations de mesure (pour affichage sur carte)
async function getStationsEau(bbox) {
  const [west, south, east, north] = bbox;
  const response = await fetch(
    `${HUBEAU_BASE}/stations?longitude_min=${west}&longitude_max=${east}&latitude_min=${south}&latitude_max=${north}&size=500`
  );
  return (await response.json()).data;
}
```

#### Schéma SQL qualité eau

```sql
CREATE TABLE public.qualite_eau (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_commune text NOT NULL,
  code_reseau text NOT NULL,
  nom_reseau text,
  date_prelevement date NOT NULL,
  parametre_code text NOT NULL,
  parametre_nom text,
  resultat_numerique numeric,
  unite text,
  limite_qualite numeric,
  reference_qualite numeric,
  conformite text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(code_reseau, date_prelevement, parametre_code)
);

-- Vue dernière analyse par paramètre
CREATE VIEW public.v_derniere_analyse_eau AS
SELECT DISTINCT ON (code_commune, parametre_code)
  code_commune,
  nom_reseau,
  date_prelevement,
  parametre_nom,
  resultat_numerique,
  unite,
  limite_qualite,
  CASE
    WHEN limite_qualite IS NOT NULL AND resultat_numerique > limite_qualite THEN 'depassement'
    WHEN reference_qualite IS NOT NULL AND resultat_numerique > reference_qualite THEN 'vigilance'
    ELSE 'conforme'
  END AS statut
FROM public.qualite_eau
ORDER BY code_commune, parametre_code, date_prelevement DESC;
```

### 8. Comptes des collectivités - DGFIP

Données comptables de toutes les communes depuis 2000.

```javascript
// scripts/import-comptes-communes.js
// Source: https://www.data.gouv.fr/fr/datasets/comptes-individuels-des-communes-fichier-global-a-compter-de-2000/

async function importComptesCommune(codeInsee, annee) {
  const url = `https://www.data.gouv.fr/api/1/datasets/r/3b432125-6e24-4e09-95f4-25bc62ef2a17`;

  // Le fichier CSV contient toutes les communes
  // Filtrer par SIREN de la commune
  const siren = await getSirenCommune(codeInsee);

  // Variables clés à suivre
  const variables = [
    "DGF", // Dotation globale de fonctionnement
    "FISCALE", // Recettes fiscales
    "EMPRUNT", // Encours dette
    "INVEST", // Dépenses d'investissement
    "FONCT", // Dépenses de fonctionnement
    "PERSONNEL", // Charges de personnel
    "EPARGNE_BRUTE", // Épargne brute
  ];

  // Import dans Supabase
  await supabase.from("comptes_collectivites").upsert(
    {
      code_insee: codeInsee,
      annee: annee,
      type_collectivite: "commune",
      recettes_fonctionnement: data.recettes_fonctionnement,
      depenses_fonctionnement: data.depenses_fonctionnement,
      recettes_investissement: data.recettes_investissement,
      depenses_investissement: data.depenses_investissement,
      encours_dette: data.encours_dette,
      annuite_dette: data.annuite_dette,
      epargne_brute: data.epargne_brute,
      population_dgf: data.population,
      dgf: data.dgf,
    },
    { onConflict: ["code_insee", "annee"] }
  );
}
```

#### Schéma SQL comptes

```sql
CREATE TABLE public.comptes_collectivites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code_insee text NOT NULL,
  annee integer NOT NULL,
  type_collectivite text DEFAULT 'commune',

  -- Budget principal
  recettes_fonctionnement numeric(15,2),
  depenses_fonctionnement numeric(15,2),
  recettes_investissement numeric(15,2),
  depenses_investissement numeric(15,2),

  -- Dette
  encours_dette numeric(15,2),
  annuite_dette numeric(15,2),
  capacite_desendettement numeric(5,1), -- en années

  -- Indicateurs
  epargne_brute numeric(15,2),
  epargne_nette numeric(15,2),

  -- Contexte
  population_dgf integer,
  dgf numeric(15,2),

  created_at timestamptz DEFAULT now(),
  UNIQUE(code_insee, annee)
);

-- Indicateurs par habitant
CREATE VIEW public.v_indicateurs_financiers AS
SELECT
  code_insee,
  annee,
  population_dgf,
  ROUND(depenses_fonctionnement / NULLIF(population_dgf, 0), 2) AS depenses_fonct_hab,
  ROUND(encours_dette / NULLIF(population_dgf, 0), 2) AS dette_hab,
  ROUND(epargne_brute / NULLIF(population_dgf, 0), 2) AS epargne_hab,
  ROUND(100.0 * epargne_brute / NULLIF(recettes_fonctionnement, 0), 1) AS taux_epargne_pct,
  ROUND(encours_dette / NULLIF(epargne_brute, 0), 1) AS capacite_desendettement
FROM public.comptes_collectivites;

-- Évolution sur 5 ans
CREATE VIEW public.v_evolution_finances AS
SELECT
  c.code_insee,
  c.annee,
  c.encours_dette,
  c.epargne_brute,
  LAG(c.encours_dette) OVER (PARTITION BY c.code_insee ORDER BY c.annee) AS dette_n1,
  ROUND(100.0 * (c.encours_dette - LAG(c.encours_dette) OVER (PARTITION BY c.code_insee ORDER BY c.annee))
    / NULLIF(LAG(c.encours_dette) OVER (PARTITION BY c.code_insee ORDER BY c.annee), 0), 1) AS evolution_dette_pct
FROM public.comptes_collectivites c;
```

### 9. Représentants d'intérêts (Lobbys) - HATVP

Registre AGORA des lobbyistes déclarant des actions auprès des élus.

```javascript
// scripts/sync-lobbys.js
const LOBBYS_URL = "https://www.data.gouv.fr/api/1/datasets/r/46cd8d72-dd5e-4198-88b5-ab95702ba6dd";

async function syncLobbys() {
  const response = await fetch(LOBBYS_URL);
  const data = await response.json();

  for (const representant of data.representants || []) {
    await supabase.from("representants_interets").upsert(
      {
        identifiant_hatvp: representant.identifiant,
        denomination: representant.denomination,
        type_organisation: representant.typeOrganisation, // 'Entreprise', 'Association', 'Cabinet'
        domaines_activite: representant.domainesActivite,
        chiffre_affaires: representant.chiffreAffaires,
        effectif: representant.effectif,

        // Activités déclarées
        nb_actions_annee: representant.actions?.length || 0,
        actions: representant.actions,

        // Cibles des actions
        responsables_publics_cibles: representant.responsablesPublicsCibles,
        decisions_publiques_cibles: representant.decisionsPubliquesCibles,

        // Moyens
        depenses_lobbying: representant.depenses,
        dons_partis_politiques: representant.donsPartis,
        avantages_offerts: representant.avantages,
      },
      { onConflict: "identifiant_hatvp" }
    );
  }
}
```

#### Schéma SQL lobbys

```sql
CREATE TABLE public.representants_interets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  identifiant_hatvp text UNIQUE NOT NULL,
  denomination text NOT NULL,
  type_organisation text,
  domaines_activite text[],
  chiffre_affaires text, -- Tranche
  effectif text,

  -- Activités
  nb_actions_annee integer DEFAULT 0,
  actions jsonb,
  responsables_publics_cibles text[],
  decisions_publiques_cibles text[],

  -- Moyens financiers
  depenses_lobbying text, -- Tranche (ex: '10 000 € - 24 999 €')
  dons_partis_politiques numeric(10,2),
  avantages_offerts jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Actions de lobbying sur un territoire
CREATE VIEW public.v_lobbying_local AS
SELECT
  r.denomination,
  r.type_organisation,
  a.value->>'objet' AS objet_action,
  a.value->>'responsablePublic' AS responsable_cible,
  a.value->>'dateAction' AS date_action
FROM public.representants_interets r,
LATERAL jsonb_array_elements(r.actions) AS a
WHERE a.value->>'territoire' ILIKE '%corse%'
   OR a.value->>'responsablePublic' ILIKE '%corse%';
```

### 10. API Carto IGN - Données cadastrales et urbanisme

API REST gratuite pour interroger cadastre, PLU et données géographiques.

```javascript
// lib/apicarto.js
const APICARTO_BASE = "https://apicarto.ign.fr/api";

// Récupérer les parcelles d'une commune
export async function getParcelles(codeInsee, section = null) {
  let url = `${APICARTO_BASE}/cadastre/parcelle?code_insee=${codeInsee}`;
  if (section) url += `&section=${section}`;

  const response = await fetch(url);
  return await response.json(); // GeoJSON FeatureCollection
}

// Récupérer le zonage PLU d'une parcelle
export async function getZonagePLU(codeInsee, section, numero) {
  const response = await fetch(
    `${APICARTO_BASE}/gpu/zone-urba?partition=DU_${codeInsee}&code_insee=${codeInsee}`
  );
  return await response.json();
}

// Récupérer les prescriptions d'urbanisme
export async function getPrescriptions(codeInsee) {
  const response = await fetch(`${APICARTO_BASE}/gpu/prescription-surf?partition=DU_${codeInsee}`);
  return await response.json();
}

// Récupérer les servitudes d'utilité publique (SUP)
export async function getServitudes(codeInsee) {
  const response = await fetch(`${APICARTO_BASE}/gpu/acte-sup?partition=DU_${codeInsee}`);
  return await response.json();
}

// Intersection géométrique personnalisée
export async function intersectGeometry(geojsonGeom, layerName) {
  const response = await fetch(`${APICARTO_BASE}/cadastre/parcelle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geom: geojsonGeom }),
  });
  return await response.json();
}
```

#### Composant parcelle interactive

```jsx
// src/components/gis/ParcelleInfo.jsx
import { useState } from "react";
import { getParcelles, getZonagePLU, getPrescriptions } from "@/lib/apicarto";

export function ParcelleInfo({ codeInsee, parcelleId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadParcelleDetails() {
    setLoading(true);
    const [section, numero] = parcelleId.split("-");

    const [parcelle, zonage, prescriptions] = await Promise.all([
      getParcelles(codeInsee, section),
      getZonagePLU(codeInsee, section, numero),
      getPrescriptions(codeInsee),
    ]);

    setData({ parcelle, zonage, prescriptions });
    setLoading(false);
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-bold">📍 Parcelle {parcelleId}</h3>

      {data?.zonage && (
        <div className="mt-2">
          <span className="text-sm text-gray-600">Zonage PLU :</span>
          <span className="ml-2 px-2 py-1 bg-blue-100 rounded">
            {data.zonage.features?.[0]?.properties?.typezone}
          </span>
          <p className="text-xs text-gray-500">{data.zonage.features?.[0]?.properties?.libelle}</p>
        </div>
      )}

      {data?.prescriptions?.features?.length > 0 && (
        <div className="mt-2">
          <span className="text-sm text-gray-600">Prescriptions :</span>
          <ul className="text-xs">
            {data.prescriptions.features.map((p, i) => (
              <li key={i}>⚠️ {p.properties.libelle}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 11. Registre Parcellaire Graphique (RPG) - Agriculture

Données des cultures déclarées par les agriculteurs (PAC).

```javascript
// lib/rpg.js
const RPG_API = "https://apicarto.ign.fr/api/rpg";

export async function getCultures(codeInsee, annee = 2023) {
  const response = await fetch(
    `${RPG_API}/v2?code_cultu=*&annee=${annee}&code_commune=${codeInsee}`
  );
  return await response.json();
}

// Types de cultures les plus fréquents
const CULTURES = {
  BTH: "Blé tendre hiver",
  BTD: "Blé dur",
  ORH: "Orge hiver",
  MAS: "Maïs grain",
  TRN: "Tournesol",
  CZA: "Colza",
  PPH: "Prairie permanente herbe",
  VRC: "Vigne (raisin de cuve)",
};
```

### 12. Qualité de l'air - Géod'Air / ATMO

```javascript
// lib/qualite-air.js
// API nationale qualité de l'air
const GEODAIR_API = "https://services9.arcgis.com/7Sr9Ek9c1QTKmbwr/arcgis/rest/services";

export async function getIndiceATMO(codeInsee) {
  // Indices quotidiens par commune
  const response = await fetch(
    `${GEODAIR_API}/Indice_quotidien_de_qualite_de_l_air/FeatureServer/0/query?` +
      `where=code_zone='${codeInsee}'&outFields=*&f=json`
  );
  const data = await response.json();
  return data.features?.[0]?.attributes;
}

export async function getStationsMesure(bbox) {
  // Stations de mesure dans une bbox
  const [xmin, ymin, xmax, ymax] = bbox;
  const response = await fetch(
    `${GEODAIR_API}/Stations_France/FeatureServer/0/query?` +
      `geometry=${xmin},${ymin},${xmax},${ymax}&geometryType=esriGeometryEnvelope&f=json`
  );
  return await response.json();
}

// Codes couleur indice ATMO
const ATMO_COLORS = {
  1: { label: "Bon", color: "#50f0e6" },
  2: { label: "Moyen", color: "#50ccaa" },
  3: { label: "Dégradé", color: "#f0e641" },
  4: { label: "Mauvais", color: "#ff5050" },
  5: { label: "Très mauvais", color: "#960032" },
  6: { label: "Extrêmement mauvais", color: "#7d2181" },
};
```

### 13. Plan Cadastral Informatisé (PCI)

Téléchargement direct des feuilles cadastrales.

```javascript
// lib/cadastre.js
const CADASTRE_BASE = "https://cadastre.data.gouv.fr/data";

// URL de téléchargement GeoJSON par commune
export function getCadastreUrl(codeInsee, format = "geojson") {
  const dept = codeInsee.slice(0, 2);
  return {
    parcelles: `${CADASTRE_BASE}/etalab-cadastre/latest/${format}/communes/${dept}/${codeInsee}/cadastre-${codeInsee}-parcelles.json`,
    batiments: `${CADASTRE_BASE}/etalab-cadastre/latest/${format}/communes/${dept}/${codeInsee}/cadastre-${codeInsee}-batiments.json`,
    sections: `${CADASTRE_BASE}/etalab-cadastre/latest/${format}/communes/${dept}/${codeInsee}/cadastre-${codeInsee}-sections.json`,
  };
}

// Import local des parcelles
export async function importCadastre(codeInsee) {
  const urls = getCadastreUrl(codeInsee);

  const parcelles = await fetch(urls.parcelles).then((r) => r.json());

  for (const feature of parcelles.features) {
    await supabase.from("parcelles_cadastre").upsert(
      {
        id_parcelle: feature.properties.id,
        code_insee: codeInsee,
        section: feature.properties.section,
        numero: feature.properties.numero,
        contenance: feature.properties.contenance, // m²
        geometry: feature.geometry,
      },
      { onConflict: "id_parcelle" }
    );
  }
}
```

### Tableau récapitulatif étendu

| Source            | API          | Gratuit | MàJ         | Accès    | Usage               |
| ----------------- | ------------ | ------- | ----------- | -------- | ------------------- |
| **Hub'Eau**       | REST         | ✅      | Continue    | Direct   | Qualité eau, nappes |
| **API Carto**     | REST         | ✅      | Continue    | Direct   | Cadastre, PLU, RPG  |
| **Géod'Air**      | ArcGIS       | ✅      | Quotidien   | Direct   | Qualité air, ATMO   |
| **Cadastre PCI**  | Download     | ✅      | Trimestriel | Direct   | Parcelles vecteur   |
| **Comptes DGFIP** | CSV          | ✅      | Annuel      | Download | Finances communes   |
| **HATVP Lobbys**  | JSON         | ✅      | Quotidien   | Direct   | Actions lobbying    |
| **Géorisques**    | WFS/JSON     | ✅      | Variable    | Direct   | Risques naturels    |
| **DECP**          | JSON         | ✅      | Mensuel     | Download | Marchés publics     |
| **Sitadel**       | DIDO API     | ✅      | Mensuel     | Direct   | Permis construire   |
| **RNE**           | CSV          | ✅      | Hebdo       | Download | Élus locaux         |
| **DVF**           | CSV/GeoJSON  | ✅      | Semestriel  | Download | Ventes immo         |
| **BODACC**        | OpenDataSoft | ✅      | Quotidien   | API      | Annonces légales    |
| **GPU**           | ATOM/WFS     | ✅      | Continue    | Direct   | Zonages PLU         |

---

## Crowdsourcing des données manquantes

Pour combler les lacunes des sources officielles, nous permettons aux citoyens de contribuer les
informations locales non disponibles en open data.

### Types de contributions citoyennes

| Catégorie               | Exemples                   | Difficulté vérification          |
| ----------------------- | -------------------------- | -------------------------------- |
| **Enquêtes publiques**  | PLU, permis, environnement | 🟢 Facile (documents PDF)        |
| **Recours contentieux** | TA, CAA, CE                | 🟡 Moyen (jugements publics)     |
| **Réunions publiques**  | Conseils, commissions      | 🟢 Facile (convocations)         |
| **Équipements locaux**  | Sport, culture, services   | 🟢 Facile (vérifiable sur place) |
| **Nuisances signalées** | Bruit, odeurs, pollution   | 🟡 Moyen (subjectif)             |
| **Travaux en cours**    | Voirie, réseaux            | 🟢 Facile (visible)              |
| **Patrimoine local**    | Bâtiments, histoire        | 🟡 Moyen (sources variables)     |
| **Biodiversité**        | Espèces observées          | 🟡 Moyen (expertise requise)     |

### Schéma SQL générique pour contributions

```sql
-- Table principale des contributions citoyennes (toutes catégories)
CREATE TABLE public.contributions_citoyennes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Catégorisation
  categorie text NOT NULL CHECK (categorie IN (
    'enquete_publique',
    'recours_contentieux',
    'reunion_publique',
    'equipement_local',
    'nuisance',
    'travaux',
    'patrimoine',
    'biodiversite',
    'autre'
  )),
  sous_categorie text, -- Ex: 'PLU', 'permis_construire', 'ICPE'...

  -- Localisation
  commune_code text NOT NULL,
  geometry geometry(Geometry, 4326), -- Point, Polygon, ou LineString
  adresse text,
  parcelle_id text, -- Lien optionnel vers parcelle cadastrale

  -- Contenu
  titre text NOT NULL,
  description text,
  date_evenement date, -- Date de l'événement signalé
  date_fin date, -- Pour les événements avec durée

  -- Pièces jointes
  documents jsonb DEFAULT '[]', -- [{url, type, nom, taille}]
  photos jsonb DEFAULT '[]',
  liens_externes jsonb DEFAULT '[]', -- URLs vers sources officielles

  -- Métadonnées contribution
  contributeur_id uuid REFERENCES auth.users(id),
  contributeur_pseudo text, -- Pour affichage public
  date_contribution timestamptz DEFAULT now(),
  source_info text, -- Comment le contributeur a obtenu l'info

  -- Statut et modération (échelle nuancée comme zonage)
  statut text DEFAULT 'en_attente' CHECK (statut IN (
    'en_attente',      -- Nouvelle contribution
    'en_verification', -- Modérateur l'examine
    'contestee',       -- Débat en cours
    'probable',        -- Semble crédible mais non prouvé
    'corroboree',      -- Confirmée par d'autres
    'documentee',      -- Preuves fournies
    'officielle',      -- Confirmée par source officielle
    'rejetee',         -- Fausse ou non vérifiable
    'obsolete'         -- Remplacée par info plus récente
  )),
  niveau_confiance integer DEFAULT 0 CHECK (niveau_confiance BETWEEN 0 AND 100),

  -- Modération
  moderateur_id uuid,
  date_moderation timestamptz,
  commentaire_moderation text,

  -- Indexation
  tags text[] DEFAULT '{}',
  search_vector tsvector,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Votes et corroborations sur contributions
CREATE TABLE public.contributions_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id uuid REFERENCES public.contributions_citoyennes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),

  type_vote text NOT NULL CHECK (type_vote IN (
    'corrobore',   -- Je confirme cette info
    'conteste',    -- Je conteste cette info
    'complete',    -- J'ajoute des précisions
    'source'       -- J'apporte une source officielle
  )),

  commentaire text,
  document_url text, -- Preuve jointe au vote

  created_at timestamptz DEFAULT now(),
  UNIQUE(contribution_id, user_id, type_vote)
);

-- Historique des enquêtes publiques
CREATE TABLE public.enquetes_publiques (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id uuid REFERENCES public.contributions_citoyennes(id),

  -- Identification
  type_enquete text NOT NULL CHECK (type_enquete IN (
    'PLU', 'PLUi', 'modification_PLU', 'revision_PLU',
    'permis_construire', 'permis_amenager',
    'ICPE', 'carriere',
    'DUP', 'expropriation',
    'servitude', 'PPRI', 'PPRN',
    'autre'
  )),
  numero_enquete text,

  -- Dates clés
  date_ouverture date NOT NULL,
  date_cloture date NOT NULL,
  date_rapport date, -- Rapport du commissaire enquêteur

  -- Localisation
  communes_concernees text[], -- Plusieurs communes possibles
  parcelles_concernees text[],

  -- Documents
  arrete_ouverture_url text,
  dossier_enquete_url text,
  rapport_ce_url text, -- Commissaire enquêteur
  conclusions_url text,

  -- Résultat
  avis_ce text CHECK (avis_ce IN ('favorable', 'favorable_reserves', 'defavorable', 'en_attente')),
  decision_finale text,
  date_decision date,

  -- Stats participation
  nb_observations integer DEFAULT 0,
  nb_contributions_registre integer DEFAULT 0,

  created_at timestamptz DEFAULT now()
);

-- Recours contentieux signalés
CREATE TABLE public.recours_contentieux (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id uuid REFERENCES public.contributions_citoyennes(id),

  -- Identification
  type_recours text NOT NULL CHECK (type_recours IN (
    'annulation_permis',
    'annulation_PLU',
    'refere_suspension',
    'exces_pouvoir',
    'plein_contentieux',
    'autre'
  )),

  -- Juridiction
  juridiction text CHECK (juridiction IN ('TA', 'CAA', 'CE')), -- Tribunal Administratif, Cour, Conseil d'État
  ville_juridiction text,
  numero_affaire text,

  -- Parties
  requerant_type text, -- 'particulier', 'association', 'collectivite'
  requerant_nom text, -- Si public (associations notamment)
  defendeur text,

  -- Objet
  acte_attaque text, -- Description de l'acte contesté
  acte_reference text, -- Numéro de l'acte
  parcelles_concernees text[],

  -- Procédure
  date_depot date,
  date_audience date,
  date_jugement date,

  -- Décision
  sens_decision text CHECK (sens_decision IN (
    'annulation_totale',
    'annulation_partielle',
    'rejet',
    'non_lieu',
    'desistement',
    'en_cours'
  )),

  -- Documents
  requete_url text,
  jugement_url text,

  created_at timestamptz DEFAULT now()
);

-- Nuisances et signalements environnementaux
CREATE TABLE public.signalements_nuisances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contribution_id uuid REFERENCES public.contributions_citoyennes(id),

  type_nuisance text NOT NULL CHECK (type_nuisance IN (
    'bruit', 'odeur', 'pollution_air', 'pollution_eau',
    'pollution_sol', 'dechets_sauvages', 'lumiere',
    'vibrations', 'poussiere', 'autre'
  )),

  -- Source suspectée
  source_identifiee boolean DEFAULT false,
  source_description text,
  source_icpe_id text, -- Lien vers ICPE si identifiée

  -- Caractérisation
  frequence text CHECK (frequence IN ('ponctuel', 'quotidien', 'hebdomadaire', 'permanent')),
  intensite text CHECK (intensite IN ('faible', 'modere', 'fort', 'insupportable')),
  horaires text, -- Ex: "6h-8h et 18h-20h"

  -- Impact
  nb_personnes_affectees integer,
  impact_sante boolean DEFAULT false,
  impact_sante_description text,

  -- Démarches effectuées
  signale_mairie boolean DEFAULT false,
  date_signalement_mairie date,
  signale_prefecture boolean DEFAULT false,
  signale_ars boolean DEFAULT false,
  reponse_obtenue text,

  created_at timestamptz DEFAULT now()
);

-- Index et recherche
CREATE INDEX idx_contributions_categorie ON public.contributions_citoyennes(categorie);
CREATE INDEX idx_contributions_commune ON public.contributions_citoyennes(commune_code);
CREATE INDEX idx_contributions_statut ON public.contributions_citoyennes(statut);
CREATE INDEX idx_contributions_geom ON public.contributions_citoyennes USING GIST(geometry);
CREATE INDEX idx_contributions_search ON public.contributions_citoyennes USING GIN(search_vector);

-- Trigger recherche full-text
CREATE OR REPLACE FUNCTION update_contribution_search() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('french',
    COALESCE(NEW.titre, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contributions_search_update
  BEFORE INSERT OR UPDATE ON public.contributions_citoyennes
  FOR EACH ROW EXECUTE FUNCTION update_contribution_search();
```

### Composant formulaire de contribution

```jsx
// src/components/gis/ContributionForm.jsx
import { useState } from "react";
import { useMap } from "react-leaflet";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { value: "enquete_publique", label: "📋 Enquête publique", icon: "📋" },
  { value: "recours_contentieux", label: "⚖️ Recours contentieux", icon: "⚖️" },
  { value: "reunion_publique", label: "🏛️ Réunion publique", icon: "🏛️" },
  { value: "equipement_local", label: "🏟️ Équipement local", icon: "🏟️" },
  { value: "nuisance", label: "🔊 Nuisance / pollution", icon: "🔊" },
  { value: "travaux", label: "🚧 Travaux en cours", icon: "🚧" },
  { value: "patrimoine", label: "🏛️ Patrimoine local", icon: "🏛️" },
  { value: "biodiversite", label: "🦋 Biodiversité", icon: "🦋" },
  { value: "autre", label: "📝 Autre information", icon: "📝" },
];

const SOUS_CATEGORIES = {
  enquete_publique: ["PLU", "PLUi", "Permis construire", "ICPE", "PPRI", "DUP", "Autre"],
  recours_contentieux: ["Annulation permis", "Annulation PLU", "Référé", "Autre"],
  nuisance: ["Bruit", "Odeur", "Pollution air", "Pollution eau", "Déchets", "Autre"],
  equipement_local: ["Sport", "Culture", "Éducation", "Santé", "Transport", "Autre"],
  biodiversite: ["Faune", "Flore", "Zone humide", "Corridor écologique", "Autre"],
};

export function ContributionForm({ communeCode, onSuccess, initialGeometry }) {
  const [form, setForm] = useState({
    categorie: "",
    sous_categorie: "",
    titre: "",
    description: "",
    date_evenement: "",
    date_fin: "",
    source_info: "",
    tags: [],
  });
  const [geometry, setGeometry] = useState(initialGeometry);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload documents si présents
      const uploadedDocs = await Promise.all(
        documents.map(async (file) => {
          const path = `contributions/${Date.now()}-${file.name}`;
          const { data } = await supabase.storage.from("documents").upload(path, file);
          return {
            url: data?.path,
            nom: file.name,
            type: file.type,
            taille: file.size,
          };
        })
      );

      // Créer la contribution
      const { data, error } = await supabase
        .from("contributions_citoyennes")
        .insert({
          ...form,
          commune_code: communeCode,
          geometry: geometry,
          documents: uploadedDocs,
          contributeur_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Si c'est une enquête publique, créer l'entrée détaillée
      if (form.categorie === "enquete_publique") {
        await createEnqueteDetails(data.id, form);
      }

      onSuccess?.(data);
    } catch (err) {
      console.error("Erreur contribution:", err);
      alert("Erreur lors de la soumission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-bold">📝 Signaler une information locale</h3>

      {/* Catégorie */}
      <div>
        <label className="block text-sm font-medium mb-1">Type d'information</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, categorie: cat.value, sous_categorie: "" }))}
              className={`p-2 text-sm rounded border ${
                form.categorie === cat.value
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {cat.icon} {cat.label.split(" ").slice(1).join(" ")}
            </button>
          ))}
        </div>
      </div>

      {/* Sous-catégorie si applicable */}
      {SOUS_CATEGORIES[form.categorie] && (
        <div>
          <label className="block text-sm font-medium mb-1">Précision</label>
          <select
            value={form.sous_categorie}
            onChange={(e) => setForm((f) => ({ ...f, sous_categorie: e.target.value }))}
            className="w-full p-2 border rounded"
          >
            <option value="">-- Sélectionner --</option>
            {SOUS_CATEGORIES[form.categorie].map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Titre */}
      <div>
        <label className="block text-sm font-medium mb-1">Titre *</label>
        <input
          type="text"
          required
          value={form.titre}
          onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
          placeholder="Ex: Enquête publique modification PLU secteur Restonica"
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={4}
          placeholder="Décrivez l'information, les enjeux, les dates importantes..."
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date (début)</label>
          <input
            type="date"
            value={form.date_evenement}
            onChange={(e) => setForm((f) => ({ ...f, date_evenement: e.target.value }))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date fin (optionnel)</label>
          <input
            type="date"
            value={form.date_fin}
            onChange={(e) => setForm((f) => ({ ...f, date_fin: e.target.value }))}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      {/* Localisation sur carte */}
      <div>
        <label className="block text-sm font-medium mb-1">Localisation</label>
        <div className="h-48 bg-gray-100 rounded border flex items-center justify-center">
          {geometry ? (
            <span className="text-green-600">✓ Zone définie sur la carte</span>
          ) : (
            <span className="text-gray-500">Dessinez la zone concernée sur la carte</span>
          )}
        </div>
      </div>

      {/* Documents */}
      <div>
        <label className="block text-sm font-medium mb-1">Documents (PDF, images)</label>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => setDocuments([...e.target.files])}
          className="w-full p-2 border rounded"
        />
        <p className="text-xs text-gray-500 mt-1">
          Arrêté, affiche, photo, jugement... Tout document utile
        </p>
      </div>

      {/* Source */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Comment avez-vous obtenu cette info ?
        </label>
        <input
          type="text"
          value={form.source_info}
          onChange={(e) => setForm((f) => ({ ...f, source_info: e.target.value }))}
          placeholder="Ex: Affichage en mairie, site web préfecture, courrier..."
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1">Mots-clés (optionnel)</label>
        <input
          type="text"
          placeholder="urbanisme, environnement, patrimoine... (séparés par virgule)"
          onChange={(e) =>
            setForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()) }))
          }
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Avertissement */}
      <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm">
        <p className="font-medium">⚠️ Engagement de véracité</p>
        <p className="text-gray-600">
          En soumettant, vous attestez que ces informations sont exactes à votre connaissance. Les
          contributions seront vérifiées par la communauté.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !form.categorie || !form.titre}
        className="w-full py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-300"
      >
        {loading ? "Envoi en cours..." : "📤 Soumettre la contribution"}
      </button>
    </form>
  );
}
```

### Formulaire spécifique enquêtes publiques

```jsx
// src/components/gis/EnquetePubliqueForm.jsx
export function EnquetePubliqueForm({ contributionId, communeCode }) {
  const [form, setForm] = useState({
    type_enquete: "",
    numero_enquete: "",
    date_ouverture: "",
    date_cloture: "",
    communes_concernees: [communeCode],
    arrete_ouverture_url: "",
    dossier_enquete_url: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();

    await supabase.from("enquetes_publiques").insert({
      contribution_id: contributionId,
      ...form,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h4 className="font-bold">📋 Détails de l'enquête publique</h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Type d'enquête</label>
          <select
            value={form.type_enquete}
            onChange={(e) => setForm((f) => ({ ...f, type_enquete: e.target.value }))}
            className="w-full p-2 border rounded"
            required
          >
            <option value="">-- Sélectionner --</option>
            <option value="PLU">Élaboration PLU</option>
            <option value="modification_PLU">Modification PLU</option>
            <option value="revision_PLU">Révision PLU</option>
            <option value="permis_construire">Permis de construire</option>
            <option value="ICPE">Installation classée (ICPE)</option>
            <option value="PPRI">Plan de prévention inondations</option>
            <option value="DUP">Déclaration utilité publique</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">N° d'enquête</label>
          <input
            type="text"
            value={form.numero_enquete}
            onChange={(e) => setForm((f) => ({ ...f, numero_enquete: e.target.value }))}
            placeholder="Ex: E23000045/2B"
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Date ouverture *</label>
          <input
            type="date"
            required
            value={form.date_ouverture}
            onChange={(e) => setForm((f) => ({ ...f, date_ouverture: e.target.value }))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Date clôture *</label>
          <input
            type="date"
            required
            value={form.date_cloture}
            onChange={(e) => setForm((f) => ({ ...f, date_cloture: e.target.value }))}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Lien vers l'arrêté d'ouverture</label>
        <input
          type="url"
          value={form.arrete_ouverture_url}
          onChange={(e) => setForm((f) => ({ ...f, arrete_ouverture_url: e.target.value }))}
          placeholder="https://..."
          className="w-full p-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Lien vers le dossier d'enquête</label>
        <input
          type="url"
          value={form.dossier_enquete_url}
          onChange={(e) => setForm((f) => ({ ...f, dossier_enquete_url: e.target.value }))}
          placeholder="https://..."
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        ✓ Enregistrer les détails
      </button>
    </form>
  );
}
```

### Composant liste des contributions

```jsx
// src/components/gis/ContributionsList.jsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const STATUT_BADGES = {
  en_attente: { label: "En attente", color: "bg-gray-200" },
  en_verification: { label: "En vérification", color: "bg-blue-200" },
  contestee: { label: "Contestée", color: "bg-orange-200" },
  probable: { label: "Probable", color: "bg-yellow-200" },
  corroboree: { label: "Corroborée", color: "bg-green-200" },
  documentee: { label: "Documentée", color: "bg-green-300" },
  officielle: { label: "Officielle", color: "bg-green-500 text-white" },
  rejetee: { label: "Rejetée", color: "bg-red-200" },
  obsolete: { label: "Obsolète", color: "bg-gray-300" },
};

export function ContributionsList({ communeCode, categorie = null }) {
  const [contributions, setContributions] = useState([]);
  const [filter, setFilter] = useState({ categorie, statut: null });

  useEffect(() => {
    loadContributions();
  }, [communeCode, filter]);

  async function loadContributions() {
    let query = supabase
      .from("contributions_citoyennes")
      .select(
        `
        *,
        contributions_votes(type_vote)
      `
      )
      .eq("commune_code", communeCode)
      .order("date_contribution", { ascending: false });

    if (filter.categorie) {
      query = query.eq("categorie", filter.categorie);
    }
    if (filter.statut) {
      query = query.eq("statut", filter.statut);
    }

    const { data } = await query;
    setContributions(data || []);
  }

  async function voter(contributionId, typeVote) {
    await supabase.from("contributions_votes").insert({
      contribution_id: contributionId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      type_vote: typeVote,
    });
    loadContributions();
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={filter.categorie || ""}
          onChange={(e) => setFilter((f) => ({ ...f, categorie: e.target.value || null }))}
          className="p-2 border rounded text-sm"
        >
          <option value="">Toutes catégories</option>
          <option value="enquete_publique">📋 Enquêtes publiques</option>
          <option value="recours_contentieux">⚖️ Contentieux</option>
          <option value="nuisance">🔊 Nuisances</option>
          <option value="travaux">🚧 Travaux</option>
        </select>

        <select
          value={filter.statut || ""}
          onChange={(e) => setFilter((f) => ({ ...f, statut: e.target.value || null }))}
          className="p-2 border rounded text-sm"
        >
          <option value="">Tous statuts</option>
          <option value="en_attente">En attente</option>
          <option value="corroboree">Corroborées</option>
          <option value="documentee">Documentées</option>
          <option value="contestee">Contestées</option>
        </select>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {contributions.map((contrib) => {
          const nbCorrobore =
            contrib.contributions_votes?.filter((v) => v.type_vote === "corrobore").length || 0;
          const nbConteste =
            contrib.contributions_votes?.filter((v) => v.type_vote === "conteste").length || 0;
          const badge = STATUT_BADGES[contrib.statut];

          return (
            <div
              key={contrib.id}
              className="p-4 bg-white rounded-lg shadow border-l-4 border-blue-400"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(contrib.date_contribution).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <h4 className="font-bold">{contrib.titre}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {contrib.description?.slice(0, 200)}...
                  </p>

                  {contrib.date_evenement && (
                    <p className="text-xs text-gray-500 mt-2">
                      📅 {new Date(contrib.date_evenement).toLocaleDateString("fr-FR")}
                      {contrib.date_fin &&
                        ` → ${new Date(contrib.date_fin).toLocaleDateString("fr-FR")}`}
                    </p>
                  )}

                  {/* Tags */}
                  {contrib.tags?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {contrib.tags.map((tag) => (
                        <span key={tag} className="px-1 py-0.5 bg-gray-100 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confiance */}
                <div className="text-center ml-4">
                  <div
                    className="text-2xl font-bold"
                    style={{
                      color:
                        contrib.niveau_confiance > 70
                          ? "#22c55e"
                          : contrib.niveau_confiance > 40
                            ? "#eab308"
                            : "#9ca3af",
                    }}
                  >
                    {contrib.niveau_confiance}%
                  </div>
                  <div className="text-xs text-gray-500">confiance</div>
                </div>
              </div>

              {/* Actions de vote */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                <button
                  onClick={() => voter(contrib.id, "corrobore")}
                  className="flex items-center gap-1 text-sm text-green-600 hover:underline"
                >
                  ✓ Je confirme ({nbCorrobore})
                </button>
                <button
                  onClick={() => voter(contrib.id, "conteste")}
                  className="flex items-center gap-1 text-sm text-orange-600 hover:underline"
                >
                  ✗ Je conteste ({nbConteste})
                </button>
                <button
                  onClick={() => voter(contrib.id, "complete")}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  + Compléter
                </button>
                {contrib.documents?.length > 0 && (
                  <span className="text-xs text-gray-500 ml-auto">
                    📎 {contrib.documents.length} document(s)
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {contributions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucune contribution pour cette commune.
            <br />
            <span className="text-sm">Soyez le premier à signaler une information !</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Couche carte des contributions

```jsx
// src/components/gis/ContributionsLayer.jsx
import { useEffect, useState } from "react";
import { LayerGroup, Marker, Polygon, Popup } from "react-leaflet";
import { supabase } from "@/lib/supabase";

const CATEGORIE_ICONS = {
  enquete_publique: { icon: "📋", color: "#3b82f6" },
  recours_contentieux: { icon: "⚖️", color: "#8b5cf6" },
  reunion_publique: { icon: "🏛️", color: "#06b6d4" },
  nuisance: { icon: "🔊", color: "#ef4444" },
  travaux: { icon: "🚧", color: "#f97316" },
  patrimoine: { icon: "🏛️", color: "#a16207" },
  biodiversite: { icon: "🦋", color: "#22c55e" },
  equipement_local: { icon: "🏟️", color: "#0ea5e9" },
  autre: { icon: "📝", color: "#6b7280" },
};

export function ContributionsLayer({ communeCode, showCategories = null }) {
  const [contributions, setContributions] = useState([]);

  useEffect(() => {
    loadContributions();
  }, [communeCode, showCategories]);

  async function loadContributions() {
    let query = supabase
      .from("contributions_citoyennes")
      .select("*")
      .eq("commune_code", communeCode)
      .not("geometry", "is", null)
      .not("statut", "in", '("rejetee","obsolete")');

    if (showCategories) {
      query = query.in("categorie", showCategories);
    }

    const { data } = await query;
    setContributions(data || []);
  }

  return (
    <LayerGroup>
      {contributions.map((contrib) => {
        const style = CATEGORIE_ICONS[contrib.categorie];
        const geom = contrib.geometry;

        if (geom.type === "Point") {
          return (
            <Marker
              key={contrib.id}
              position={[geom.coordinates[1], geom.coordinates[0]]}
              icon={createEmojiIcon(style.icon)}
            >
              <Popup>
                <ContributionPopup contribution={contrib} />
              </Popup>
            </Marker>
          );
        }

        if (geom.type === "Polygon") {
          return (
            <Polygon
              key={contrib.id}
              positions={geom.coordinates[0].map((c) => [c[1], c[0]])}
              pathOptions={{ color: style.color, fillOpacity: 0.3 }}
            >
              <Popup>
                <ContributionPopup contribution={contrib} />
              </Popup>
            </Polygon>
          );
        }

        return null;
      })}
    </LayerGroup>
  );
}

function ContributionPopup({ contribution }) {
  const style = CATEGORIE_ICONS[contribution.categorie];

  return (
    <div className="p-2 min-w-64">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{style.icon}</span>
        <span className="font-bold">{contribution.titre}</span>
      </div>

      <p className="text-sm text-gray-600 mb-2">{contribution.description?.slice(0, 150)}...</p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Confiance: <strong>{contribution.niveau_confiance}%</strong>
        </span>
        <span>{new Date(contribution.date_contribution).toLocaleDateString("fr-FR")}</span>
      </div>

      <a
        href={`/contributions/${contribution.id}`}
        className="block mt-2 text-blue-600 text-sm hover:underline"
      >
        Voir les détails →
      </a>
    </div>
  );
}
```

### Gamification des contributions

```sql
-- Points et badges pour les contributeurs
CREATE TABLE public.contributeurs_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  pseudo text,

  -- Compteurs
  nb_contributions integer DEFAULT 0,
  nb_contributions_validees integer DEFAULT 0,
  nb_corroborations integer DEFAULT 0,
  nb_documents_fournis integer DEFAULT 0,

  -- Points
  points_total integer DEFAULT 0,

  -- Badges gagnés
  badges jsonb DEFAULT '[]',

  -- Niveau de confiance du contributeur
  fiabilite_score integer DEFAULT 50, -- 0-100

  updated_at timestamptz DEFAULT now()
);

-- Règles de scoring
-- +10 points par contribution acceptée
-- +5 points par corroboration validée
-- +20 points pour document officiel fourni
-- +50 points si contribution devient "officielle"
-- -10 points si contribution rejetée

-- Badges disponibles
-- 🌱 Planteur : première contribution
-- 📋 Archiviste : 5 enquêtes publiques signalées
-- ⚖️ Juriste citoyen : 3 recours signalés
-- 🔍 Enquêteur : 10 contributions corroborées
-- 📚 Documentaliste : 10 documents fournis
-- ⭐ Contributeur fiable : fiabilité > 80%
-- 🏆 Expert local : 50 contributions validées

CREATE OR REPLACE FUNCTION update_contributeur_stats() RETURNS trigger AS $$
BEGIN
  -- Mise à jour après validation d'une contribution
  IF NEW.statut IN ('corroboree', 'documentee', 'officielle') AND
     OLD.statut NOT IN ('corroboree', 'documentee', 'officielle') THEN
    UPDATE public.contributeurs_stats
    SET
      nb_contributions_validees = nb_contributions_validees + 1,
      points_total = points_total + CASE NEW.statut
        WHEN 'corroboree' THEN 10
        WHEN 'documentee' THEN 15
        WHEN 'officielle' THEN 50
        ELSE 0
      END,
      updated_at = now()
    WHERE user_id = NEW.contributeur_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contribution_validated
  AFTER UPDATE ON public.contributions_citoyennes
  FOR EACH ROW EXECUTE FUNCTION update_contributeur_stats();
```

### Vue synthèse pour la commune

```sql
-- Statistiques des contributions par commune
CREATE VIEW public.v_stats_contributions_commune AS
SELECT
  commune_code,
  categorie,
  COUNT(*) AS nb_total,
  COUNT(*) FILTER (WHERE statut IN ('corroboree', 'documentee', 'officielle')) AS nb_validees,
  COUNT(*) FILTER (WHERE statut = 'en_attente') AS nb_en_attente,
  COUNT(*) FILTER (WHERE date_evenement > CURRENT_DATE) AS nb_a_venir,
  AVG(niveau_confiance) AS confiance_moyenne
FROM public.contributions_citoyennes
WHERE statut NOT IN ('rejetee', 'obsolete')
GROUP BY commune_code, categorie;

-- Enquêtes publiques en cours
CREATE VIEW public.v_enquetes_en_cours AS
SELECT
  e.*,
  c.titre,
  c.description,
  c.geometry,
  c.niveau_confiance
FROM public.enquetes_publiques e
JOIN public.contributions_citoyennes c ON c.id = e.contribution_id
WHERE e.date_cloture >= CURRENT_DATE
  AND e.date_ouverture <= CURRENT_DATE
  AND c.statut NOT IN ('rejetee', 'obsolete')
ORDER BY e.date_cloture ASC;
```

### Cron jobs consolidés

```javascript
// scripts/cron-transparency.js
// À exécuter via cron ou GitHub Actions

const TASKS = [
  { name: "GPU ATOM", fn: syncGPU, schedule: "0 6 * * *" }, // 6h quotidien
  { name: "BODACC", fn: watchBODACC, schedule: "0 8 * * *" }, // 8h quotidien
  { name: "ICPE", fn: importICPE, schedule: "0 3 1 * *" }, // 3h le 1er mensuel
  { name: "DECP", fn: importDECP, schedule: "0 4 1 * *" }, // 4h le 1er mensuel
  { name: "Sitadel", fn: importSitadel, schedule: "0 5 1 * *" }, // 5h le 1er mensuel
  { name: "RNE", fn: syncRNE, schedule: "0 2 * * 1" }, // 2h lundi
  { name: "HATVP", fn: syncHATVP, schedule: "0 2 1 */3 *" }, // 2h trimestriel
  { name: "DVF", fn: importDVF, schedule: "0 3 15 4,10 *" }, // 3h 15 avril/octobre
  { name: "Délibérations", fn: scrapeDeliberations, schedule: "0 7 * * 1" }, // 7h lundi
];
```

## Points à clarifier

1. **Données Corte** - Quel format est disponible sur le site de la mairie ?
2. ~~**Calques par collectivité** - Activer le filtrage via `collectivite_id` ?~~ → Résolu :
   isolation par instance
3. **Cache WFS** - Mettre en cache les données BD TOPO localement pour performances ?
4. **Thématiques prioritaires** - Quels calques "experts" activer en priorité ? (environnement,
   agriculture...)
5. **Communes à surveiller** - Liste des codes INSEE à inclure dans le suivi GPU ?

---

## Fédération GIS multi-instance

### Agrégation des données entre instances

Lorsqu'une instance parent (hub communal) agrège les données de ses instances filles (quartiers),
plusieurs stratégies sont possibles :

#### Stratégie 1 : Requêtes fédérées (temps réel)

```javascript
// Dans le hub corte.lepp.fr
// Agrège les incidents de tous les quartiers

async function fetchFederatedIncidents(hubSubdomain) {
  // 1. Récupérer la liste des instances filles
  const { data: childInstances } = await hubSupabase
    .from("instance_registry")
    .select("subdomain, supabase_url, supabase_anon_key")
    .eq("parent_subdomain", hubSubdomain)
    .eq("status", "active");

  // 2. Requêter chaque instance en parallèle
  const allIncidents = await Promise.all(
    childInstances.map(async (child) => {
      const childClient = createClient(child.supabase_url, child.supabase_anon_key);
      const { data } = await childClient
        .from("posts")
        .select("*")
        .eq("type", "incident")
        .not("geom", "is", null);

      return (data || []).map((incident) => ({
        ...incident,
        _source_instance: child.subdomain,
      }));
    })
  );

  // 3. Fusionner les résultats
  return allIncidents.flat();
}
```

#### Stratégie 2 : Réplication périodique (cache)

```sql
-- Table de cache sur le hub
CREATE TABLE public.federated_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_instance text NOT NULL,
  data_type text NOT NULL,           -- 'incidents', 'contributions', 'stats'
  data jsonb NOT NULL,
  geometry geometry(Geometry, 4326), -- Pour requêtes spatiales
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '1 hour'
);

CREATE INDEX federated_cache_geom_idx ON public.federated_cache USING GIST(geometry);
CREATE INDEX federated_cache_type_idx ON public.federated_cache(data_type);
```

#### Stratégie 3 : Événements temps réel (Supabase Realtime)

```javascript
// Sur chaque instance fille, notifier le hub des changements
async function notifyHub(table, record, eventType) {
  const hubUrl = await getVaultValue("PARENT_HUB_URL");
  if (!hubUrl) return; // Pas de hub parent

  await fetch(`${hubUrl}/api/federated-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_instance: getCurrentSubdomain(),
      table,
      event_type: eventType,
      record,
      timestamp: new Date().toISOString(),
    }),
  });
}

// Trigger Supabase Database Webhook ou Edge Function
```

### Calques partagés vs calques locaux

| Type de calque | Scope                   | Exemple                                |
| -------------- | ----------------------- | -------------------------------------- |
| **Global**     | Toutes les instances    | Fonds de carte IGN, Cadastre, ICPE     |
| **Régional**   | Instances d'une région  | Zonage PLU/PLUi, limites EPCI          |
| **Communal**   | Commune + ses quartiers | Voirie locale, équipements municipaux  |
| **Local**      | Instance spécifique     | Points d'intérêt du quartier, parcours |

```sql
-- Calque avec scope défini
INSERT INTO map_layers (name, source_type, url, metadata) VALUES
('Équipements quartier sud', 'geojson', '/api/local-data/equipements.geojson',
 '{"scope": "local", "bounding_box": [[42.300, 9.140], [42.310, 9.160]]}');
```

### Filtrage géographique automatique

Chaque instance peut définir son périmètre dans le vault, et les données sont automatiquement
filtrées :

```javascript
// Hook pour filtrer les données par périmètre de l'instance
export function useInstanceBoundedData(table, query = {}) {
  const boundingBox = getConfig("map_bounding_box");

  return useQuery({
    queryKey: [table, query, boundingBox],
    queryFn: async () => {
      let request = supabase.from(table).select(query.select || "*");

      // Filtrage spatial si bounding box définie
      if (boundingBox && query.useGeom !== false) {
        const [[south, west], [north, east]] = boundingBox;
        request = request.filter(
          "geom",
          "ov", // overlaps
          `SRID=4326;POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`
        );
      }

      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });
}
```

---

## Comparatif des solutions

### Ce qui est couvert vs manquant

| Fonctionnalité           | Extension IGN | Plugin Leaflet      | À développer    |
| ------------------------ | ------------- | ------------------- | --------------- |
| Fonds de carte IGN       | ✅            | -                   | -               |
| Gestion des calques      | ✅            | -                   | -               |
| Recherche d'adresse      | ✅            | -                   | -               |
| Géocodage inverse        | ✅            | -                   | -               |
| Itinéraires              | ✅            | -                   | -               |
| Isochrones               | ✅            | -                   | -               |
| Profil altimétrique      | ✅            | -                   | -               |
| Dessin de zones          | -             | `leaflet-draw`      | -               |
| Mesures distance/surface | -             | `leaflet-measure`   | -               |
| Import GPX/KML           | -             | `leaflet-omnivore`  | -               |
| Export PNG/PDF           | -             | `leaflet-easyprint` | -               |
| WFS (données vecteur)    | -             | -                   | ✅ `lib/wfs.js` |
| Vue 3D                   | ❌            | -                   | Hors scope      |

### Limitations acceptées

- **Pas de 3D** : Bâtiments et terrain 3D nécessiteraient le SDK Géoportail ou iTowns
- **Tuiles vectorielles** : Support limité (plugin `leaflet-mapbox-gl` possible mais complexe)
- **Performances gros volumes** : Pour >10 000 marqueurs, envisager le clustering ou OpenLayers
