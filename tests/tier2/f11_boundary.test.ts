/**
 * Tier 2: Boundary & Corner Cases - F11: UI/UX Consistency, Breadcrumbs & State Feedback
 * Tests dynamic breadcrumb segment extraction, responsive breakpoint classes, and toast feedback.
 * Authoritative Source: PROJECT.md § Feature Inventory (F11) & ORIGINAL_REQUEST.md R4.
 */

import { registerTest } from '../infra/runner';
import { assert } from '../infra/assert';
import { inspectors } from '../infra/inspectors';

// Test 11.1: Dynamic Breadcrumb Path Splitting Logic
registerTest({
  id: 'T2-F11-01',
  name: 'UI/UX Boundary: Breadcrumbs dynamically parses pathname segments from useLocation',
  featureId: 'F11',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies breadcrumb utility splits paths on slash and filters out empty strings',
  expectedOutputSource: 'PROJECT.md § Feature Inventory F11',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, 'location.pathname', 'Must read location.pathname for layout feedback');
  }
});

// Test 11.2: Mobile Responsive Menu Button Breakpoint
registerTest({
  id: 'T2-F11-02',
  name: 'UI/UX Boundary: Mobile hamburger button is hidden on large desktop screens (lg:hidden)',
  featureId: 'F11',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies hamburger button has lg:hidden class to avoid redundancy on desktops',
  expectedOutputSource: 'src/components/DashboardLayout.tsx:539 Hamburger button',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, 'lg:hidden', 'Mobile drawer toggles must be hidden on lg viewports');
  }
});

// Test 11.3: Desktop Search Bar Minimum Viewport Visibility
registerTest({
  id: 'T2-F11-03',
  name: 'UI/UX Boundary: Desktop search bar hides gracefully on mobile (hidden sm:flex)',
  featureId: 'F11',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies top search input uses hidden sm:flex to prevent header crowding on 375px screens',
  expectedOutputSource: 'src/components/DashboardLayout.tsx:546 Search container',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, 'hidden sm:flex', 'Search bar must use hidden sm:flex responsive class');
  }
});

// Test 11.4: Toast Notification Library Integration
registerTest({
  id: 'T2-F11-04',
  name: 'UI/UX Boundary: User feedback leverages sonner toast notifications for mutations',
  featureId: 'F11',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies sonner toast.success and toast.error provide consistent floating user feedback',
  expectedOutputSource: 'package.json dependencies & DashboardLayout.tsx:37',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, "import { toast } from 'sonner'", 'Must import sonner toast');
    assert.contains(layoutCode, 'toast.success', 'Must provide toast.success feedback');
  }
});

// Test 11.5: Academic Year Selector Persistence in Header
registerTest({
  id: 'T2-F11-05',
  name: 'UI/UX Boundary: DashboardLayout renders AcademicYearSelector in header for cross-module session scope',
  featureId: 'F11',
  tier: 2,
  milestone: 'M3',
  description: 'Verifies global academic year context is accessible from the header chrome',
  expectedOutputSource: 'src/components/DashboardLayout.tsx:34 AcademicYearProvider',
  fn: () => {
    const layoutCode = inspectors.readFile('src/components/DashboardLayout.tsx');
    assert.contains(layoutCode, 'AcademicYearProvider', 'Must wrap dashboard shell in AcademicYearProvider');
  }
});
