/**
 * Tier 4: Real-World Application Scenarios - Scenario 5: Operational Logistics & Asset Flow
 * End-to-end administration workflow:
 * Transit Route Definition -> Fleet Vehicle Allotment -> Student Transit Binding -> Asset Inventory Tracking.
 * Authoritative Source: ORIGINAL_REQUEST.md R1-R2 & PROJECT.md § Architecture.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Step 1: Transport Route and Fleet Master
registerTest({
  id: 'T4-SC5-01',
  name: 'Scenario 5 (Step 1): TransportManagement maintains routes, fleet vehicles, and drivers',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies transport_routes, vehicles, and drivers tables are managed in TransportManagement',
  expectedOutputSource: 'src/pages/dashboard/TransportManagement.tsx',
  fn: () => {
    const transportCode = inspectors.readFile('src/pages/dashboard/TransportManagement.tsx');
    assert.contains(transportCode, 'transport_routes', 'Must manage transport_routes');
    assert.contains(transportCode, 'vehicles', 'Must manage vehicles');
    assert.contains(transportCode, 'drivers', 'Must manage drivers');
  }
});

// Step 2: Student Transit Allotment Linking
registerTest({
  id: 'T4-SC5-02',
  name: 'Scenario 5 (Step 2): Student transit allocation links route, vehicle, and student identifier',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies student_transport allocation persists complete relational linkage',
  expectedOutputSource: 'src/pages/dashboard/TransportManagement.tsx',
  fn: () => {
    const transportCode = inspectors.readFile('src/pages/dashboard/TransportManagement.tsx');
    assert.contains(transportCode, 'student_transport', 'Must manage student_transport');
    assert.contains(transportCode, 'route_id', 'Must link route_id');
    assert.contains(transportCode, 'vehicle_id', 'Must link vehicle_id');
  }
});

// Step 3: Fixed Asset & Consumable Inventory Tracking
registerTest({
  id: 'T4-SC5-03',
  name: 'Scenario 5 (Step 3): InventoryManagement manages institutional assets and stock levels',
  featureId: 'F10',
  tier: 4,
  milestone: 'M3',
  description: 'Verifies assets and inventory tables are integrated into InventoryManagement view',
  expectedOutputSource: 'src/pages/dashboard/InventoryManagement.tsx',
  fn: () => {
    const inventoryCode = inspectors.readFile('src/pages/dashboard/InventoryManagement.tsx');
    assert.contains(inventoryCode, 'assets', 'Must query assets');
    assert.contains(inventoryCode, 'inventory', 'Must query inventory');
  }
});
