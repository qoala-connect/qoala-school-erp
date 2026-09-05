/**
 * Opaque-Box System Inspectors
 * Static and dynamic inspection of codebase files, routes, contracts, and schema.
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

export const inspectors = {
  getProjectRoot(): string {
    return PROJECT_ROOT;
  },

  readFile(relativePath: string): string {
    const fullPath = path.resolve(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  },

  fileExists(relativePath: string): boolean {
    const fullPath = path.resolve(PROJECT_ROOT, relativePath);
    return fs.existsSync(fullPath);
  },

  /**
   * Router and App.tsx inspection
   */
  getAppRoutes() {
    const content = this.readFile('src/App.tsx');
    const routeRegex = /<Route\s+path=["']([^"']+)["']\s+(?:element=\{([^}]+)\})?/g;
    const routes: Array<{ path: string; elementSnippet: string }> = [];
    
    // Detailed parsing of routes
    const routeBlockRegex = /<Route[\s\S]*?path=["']([^"']+)["'][\s\S]*?element=\{([\s\S]*?)\}\s*(?:\/>|<\/Route>)/g;
    let match;
    while ((match = routeBlockRegex.exec(content)) !== null) {
      routes.push({
        path: match[1],
        elementSnippet: match[2].trim()
      });
    }

    const imports: string[] = [];
    const importRegex = /import\s+(?:[\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]/g;
    let impMatch;
    while ((impMatch = importRegex.exec(content)) !== null) {
      imports.push(impMatch[1]);
    }

    return {
      rawContent: content,
      routes,
      imports,
      hasRoute(targetPath: string) {
        return routes.some(r => r.path === targetPath);
      },
      getRoute(targetPath: string) {
        return routes.find(r => r.path === targetPath);
      },
      hasRedirect(sourcePath: string, targetPath: string) {
        const r = routes.find(item => item.path === sourcePath);
        if (!r) return false;
        return r.elementSnippet.includes('Navigate') && r.elementSnippet.includes(targetPath);
      },
      getRoutePermission(targetPath: string): string | null {
        const r = routes.find(item => item.path === targetPath);
        if (!r) return null;
        const permMatch = r.elementSnippet.match(/allowedPermission=["']([^"']+)["']/);
        return permMatch ? permMatch[1] : null;
      },
      isProtected(targetPath: string): boolean {
        const r = routes.find(item => item.path === targetPath);
        if (!r) return false;
        return r.elementSnippet.includes('ProtectedRoute');
      }
    };
  },

  /**
   * Sidebar navigation in DashboardLayout.tsx
   */
  getSidebarConfig() {
    const content = this.readFile('src/components/DashboardLayout.tsx');

    return {
      rawContent: content,
      hasCategory(categoryTitle: string): boolean {
        const titleRegex = new RegExp(`title:\\s*['"\`]${categoryTitle}['"\`]`, 'i');
        return titleRegex.test(content);
      },
      hasSidebarItem(label: string, targetPath?: string): boolean {
        const labelRegex = new RegExp(`label:\\s*['"\`]${label}['"\`]`, 'i');
        if (!labelRegex.test(content)) return false;
        if (targetPath) {
          const pathRegex = new RegExp(`path:\\s*['"\`]${targetPath}['"\`]`, 'i');
          return pathRegex.test(content);
        }
        return true;
      },
      getGlobalSearchTargetForRole(roleType: 'Teacher' | 'Staff'): string {
        // Look for employee click handler in DashboardLayout
        const teacherMatch = content.match(/role\s*===\s*['"]Teacher['"][\s\S]*?\/dashboard\/teachers/);
        const fallbackMatch = content.match(/\/dashboard\/employees/);
        if (roleType === 'Teacher' && teacherMatch) {
          return '/dashboard/teachers';
        }
        return fallbackMatch ? '/dashboard/employees' : '';
      }
    };
  },

  /**
   * Cross-Module linkages and state preservation
   */
  getContextContracts() {
    const student360 = this.fileExists('src/components/students/Student360Drawer.tsx')
      ? this.readFile('src/components/students/Student360Drawer.tsx')
      : '';
    const analytics = this.fileExists('src/pages/dashboard/Analytics.tsx')
      ? this.readFile('src/pages/dashboard/Analytics.tsx')
      : '';
    const admissions = this.fileExists('src/pages/dashboard/AdmissionsManagement.tsx')
      ? this.readFile('src/pages/dashboard/AdmissionsManagement.tsx')
      : '';
    const certs = this.fileExists('src/pages/dashboard/CertificateGenerator.tsx')
      ? this.readFile('src/pages/dashboard/CertificateGenerator.tsx')
      : '';
    const fees = this.fileExists('src/pages/dashboard/FeesPortal.tsx')
      ? this.readFile('src/pages/dashboard/FeesPortal.tsx')
      : '';

    return {
      student360PassesFeeContext(): boolean {
        return (
          student360.includes("navigate('/dashboard/fees'") &&
          (student360.includes('selectedStudent') || student360.includes('selectedStudentId'))
        );
      },
      student360PassesCertContext(): boolean {
        return (
          student360.includes("navigate('/dashboard/certificates'") &&
          (student360.includes('student:') || student360.includes('admission_number'))
        );
      },
      analyticsRoutesExamCorrectly(): boolean {
        return (
          analytics.includes("navigate('/dashboard/examination") ||
          !analytics.includes("navigate('/dashboard/marks'")
        );
      },
      analyticsTotalTeachersTarget(): string {
        const match = analytics.match(/Total Teachers[\s\S]*?navigate\(['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      },
      admissionsReadsStatusFilter(): boolean {
        return admissions.includes('location.state') && admissions.includes('statusFilter');
      },
      certificatesReadsStudentState(): boolean {
        return certs.includes('location.state') && certs.includes('student');
      },
      feesPortalHandlesStudentSelection(): boolean {
        return fees.includes('selectedStudent') || fees.includes('location.state');
      }
    };
  },

  /**
   * Migration SQL and Database inspection
   */
  getMigrationFiles(): string[] {
    const files = fs.readdirSync(PROJECT_ROOT);
    return files.filter(f => f.startsWith('supabase') && f.endsWith('.sql'));
  },

  getAllMigrationSql(): string {
    const files = this.getMigrationFiles();
    return files.map(f => this.readFile(f)).join('\n\n');
  },

  /**
   * Action button inspection
   */
  getActionInteractivity() {
    const reports = this.fileExists('src/pages/dashboard/Reports.tsx')
      ? this.readFile('src/pages/dashboard/Reports.tsx')
      : '';
    const transport = this.fileExists('src/pages/dashboard/TransportManagement.tsx')
      ? this.readFile('src/pages/dashboard/TransportManagement.tsx')
      : '';
    const medical = this.fileExists('src/pages/dashboard/MedicalManagement.tsx')
      ? this.readFile('src/pages/dashboard/MedicalManagement.tsx')
      : '';
    const calendar = this.fileExists('src/pages/dashboard/SchoolCalendar.tsx')
      ? this.readFile('src/pages/dashboard/SchoolCalendar.tsx')
      : '';
    const settings = this.fileExists('src/pages/dashboard/Settings.tsx')
      ? this.readFile('src/pages/dashboard/Settings.tsx')
      : '';

    return {
      reportsHasActiveClickHandlers(): boolean {
        return reports.includes('onClick') && !reports.includes('toast.success');
      },
      settingsHasFakeToastOnly(): boolean {
        if (!settings) return false;
        return settings.includes("toast.success('System preferences updated successfully')") && !settings.includes('supabase');
      },
      transportHasStudentId(): boolean {
        return transport.includes('student_id');
      },
      medicalHasStudentId(): boolean {
        return medical.includes('student_id');
      },
      calendarUsesStartDate(): boolean {
        return calendar.includes('start_date') && !calendar.includes("order('date'");
      }
    };
  },

  /**
   * Service query patterns
   */
  getServicePatterns() {
    const serverTs = this.readFile('server.ts');
    const teacherSvc = this.readFile('src/services/teacherService.ts');
    const admissionSvc = this.readFile('src/services/admissionService.ts');
    const feeSvc = this.readFile('src/services/feeService.ts');

    return {
      serverGroundingTable(): string {
        const match = serverTs.match(/supabase\.from\(['"]([^'"]+)['"]\)\.select\(['"]id,\s*status,\s*amount/);
        return match ? match[1] : '';
      },
      teacherServiceEmployeeIdGen(): string {
        return teacherSvc.includes('count: \'exact\'') ? 'memory-count-race' : 'sequence-or-uuid';
      },
      admissionServiceHasPagination(): boolean {
        return admissionSvc.includes('.range(') || admissionSvc.includes('limit') || admissionSvc.includes('page');
      },
      feeServiceHasPagination(): boolean {
        return feeSvc.includes('.range(') || feeSvc.includes('limit') || feeSvc.includes('page');
      }
    };
  }
};
