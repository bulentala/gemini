import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GEMINI_MD: string = path.join(__dirname, 'gemini.md');
const PROJECT_ROOT: string = __dirname;
const APP_DIR: string = path.join(PROJECT_ROOT, 'app');
const LIB_DIR: string = path.join(PROJECT_ROOT, 'lib');

// =============== SABITLER ===============

const EXCLUDED_APP_FILES = ['layout.tsx', 'page.tsx', 'favicon.ico', 'globals.css'];
const EXCLUDED_ROOT_FILES = [
  'deneme.tsx', 'test.tsx', 'bulent.tsx', 'package.json', 'tsconfig.json',
  'next.config.ts', 'README.md', 'eslint.config.mjs', 'next-env.d.ts',
  'postcss.config.mjs', 'pnpm-lock.yaml', 'update-context.ts', 'gemini.md',
];

const API_PATTERNS = ['api', 'routes', 'handlers'];
const COMPONENT_PATTERNS = ['components', 'ui', 'shared'];
const TEST_PATTERNS = ['test', 'spec', '__tests__'];

// =============== TYPES ===============

interface FileInfo {
  name: string;
  path: string;
  type: 'component' | 'route' | 'page' | 'util' | 'test' | 'other';
  methods?: string[];
  modified?: number;
  imports?: string[];
  exports?: string[];
  props?: PropDefinition[];
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
}

interface ErrorLog {
  level: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
}

// =============== ERROR MANAGEMENT ===============

class ContextUpdater {
  private errors: ErrorLog[] = [];
  private startTime: number = Date.now();

  log(level: 'error' | 'warning' | 'info', message: string, file?: string): void {
    this.errors.push({ level, message, file });
    const icon = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${icon} [${level.toUpperCase()}] ${message}${file ? ` (${file})` : ''}`);
  }

  hasErrors(): boolean {
    return this.errors.some(e => e.level === 'error');
  }

  printSummary(fileCount: number): void {
    const duration = Date.now() - this.startTime;
    const summary = {
      errors: this.errors.filter(e => e.level === 'error').length,
      warnings: this.errors.filter(e => e.level === 'warning').length,
      info: this.errors.filter(e => e.level === 'info').length,
    };

    console.log('\n' + '='.repeat(60));
    console.log('📊 GÜNCELLEME ÖZET');
    console.log('='.repeat(60));
    console.log(`📁 Taranılan Dosyalar: ${fileCount}`);
    console.log(`⏱️  Süre: ${duration}ms`);
    console.log(`ℹ️  Bilgi: ${summary.info}`);
    console.log(`⚠️  Uyarı: ${summary.warnings}`);
    console.log(`❌ Hata: ${summary.errors}`);

    if (this.hasErrors()) {
      console.log('\n🚨 KRITIK HATA! Betik başarısız oldu.');
      console.log('Aşağıdaki sorunları düzeltin ve tekrar deneyin:');
      this.errors
        .filter(e => e.level === 'error')
        .forEach(e => console.log(`  • ${e.message}`));
      process.exit(1);
    } else {
      console.log('\n✅ Başarılı!');
    }
    console.log('='.repeat(60) + '\n');
  }
}

const updater = new ContextUpdater();

// =============== GELIŞTIRILMIŞ API ANALIZI ===============

function analyzeApiRoute(filePath: string): string[] {
  const methods: string[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    
    httpMethods.forEach((method) => {
      const patterns = [
        new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\s*\\(`, 'i'),
        new RegExp(`export\\s+const\\s+${method}\\s*=\\s*(async\\s*)?\\(`, 'i'),
        new RegExp(`export\\s+(async\\s+)?const\\s+${method}\\s*:\\s*`, 'i'),
      ];
      
      if (patterns.some(pattern => pattern.test(content))) {
        methods.push(method);
      }
    });

    updater.log('info', `API Route analiz: ${methods.join(', ') || 'Metot yok'}`, filePath);
  } catch (err) {
    updater.log('warning', `API okunamadı: ${err instanceof Error ? err.message : 'Hata'}`, filePath);
  }
  
  return methods;
}

// =============== COMPONENT ANALIZI - PROPS & EXPORTS ===============

function extractComponentMetadata(filePath: string): { imports: string[]; exports: string[]; props?: PropDefinition[] } {
  const imports: string[] = [];
  const exports: string[] = [];
  const props: PropDefinition[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Import'ları çıkar
    const importRegex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match[1] || match[2];
      if (imported) {
        imports.push(...imported.split(',').map(i => i.trim()));
      }
    }

    // Export'ları çıkar
    const exportRegex = /export\s+(?:default\s+)?(function|const|interface|type)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[2]);
    }

    // Interface/Props tanımlarını çıkar
    const propsRegex = /interface\s+(\w*Props)\s*{([^}]+)}/g;
    while ((match = propsRegex.exec(content)) !== null) {
      const propBody = match[2];
      const propLines = propBody.split(';').filter(Boolean);
      
      propLines.forEach(line => {
        const propMatch = /(\w+)\s*\??:\s*(.+)/.exec(line.trim());
        if (propMatch) {
          props.push({
            name: propMatch[1],
            type: propMatch[2].trim(),
            required: !line.includes('?'),
          });
        }
      });
    }
  } catch (err) {
    updater.log('warning', `Metadata çıkarılamadı: ${err instanceof Error ? err.message : 'Hata'}`, filePath);
  }

  return { imports, exports, props };
}

// =============== DİNAMİK DOSYA TARAMA (.ts, .tsx, .js, .jsx) ===============

function findAllAppFiles(): FileInfo[] {
  const files: FileInfo[] = [];
  const fileMap = new Map<string, FileInfo>();

  function scanDir(dir: string, relativePath: string = ''): void {
    if (!fs.existsSync(dir)) {
      updater.log('warning', `Dizin bulunamadı`, dir);
      return;
    }

    try {
      const items = fs.readdirSync(dir);
      items.forEach((item: string) => {
        if (item.startsWith('.') || item === 'node_modules' || EXCLUDED_APP_FILES.includes(item)) {
          return;
        }

        const fullPath = path.join(dir, item);
        
        try {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            scanDir(fullPath, `${relativePath}${item}/`);
          } else if (/(\.tsx?|\.jsx?)$/.test(item)) {
            let type: 'component' | 'route' | 'page' | 'util' | 'test' | 'other' = 'other';
            let methods: string[] = [];
            let imports: string[] = [];
            let exports: string[] = [];
            let props: PropDefinition[] = [];

            // Test dosyalarını kontrol et
            const isTest = TEST_PATTERNS.some(pattern => 
              item.includes(pattern) || relativePath.includes(pattern)
            );
            if (isTest) {
              type = 'test';
            } else {
              // Component, Route, Page kontrolü
              const isComponent = COMPONENT_PATTERNS.some(p => relativePath.includes(p));
              const isApi = API_PATTERNS.some(p => relativePath.includes(p));

              if (isComponent) {
                type = 'component';
                const metadata = extractComponentMetadata(fullPath);
                imports = metadata.imports;
                exports = metadata.exports;
                props = metadata.props;
              } else if (isApi) {
                type = 'route';
                if (item === 'route.ts' || item === 'route.tsx' || item === 'route.js' || item === 'route.jsx') {
                  methods = analyzeApiRoute(fullPath);
                }
              } else if (['page.tsx', 'page.ts', 'layout.tsx', 'layout.ts'].includes(item)) {
                type = 'page';
              }
            }

            const fileInfo: FileInfo = {
              name: item,
              path: `app/${relativePath}${item}`,
              type,
              modified: stats.mtimeMs,
              methods: methods.length > 0 ? methods : undefined,
              imports: imports.length > 0 ? imports : undefined,
              exports: exports.length > 0 ? exports : undefined,
              props: props.length > 0 ? props : undefined,
            };

            fileMap.set(fileInfo.path, fileInfo);
            updater.log('info', `${type.toUpperCase()}: ${item}`, `app/${relativePath}${item}`);
          }
        } catch (err) {
          updater.log('error', `İşleme hatası: ${err instanceof Error ? err.message : 'Hata'}`, fullPath);
        }
      });
    } catch (err) {
      updater.log('error', `Dizin okunamadı: ${err instanceof Error ? err.message : 'Hata'}`, dir);
    }
  }

  scanDir(APP_DIR);
  return Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path));
}

// =============== LIB KLASÖRÜ TARAMA ===============

function findLibFiles(): FileInfo[] {
  const files: FileInfo[] = [];

  function scanDir(dir: string, relativePath: string = ''): void {
    if (!fs.existsSync(dir)) {
      updater.log('info', `Lib dizini bulunamadı (opsiyonel)`);
      return;
    }

    try {
      const items = fs.readdirSync(dir);
      items.forEach((item: string) => {
        if (item.startsWith('.') || item === 'node_modules') return;

        const fullPath = path.join(dir, item);
        
        try {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            scanDir(fullPath, `${relativePath}${item}/`);
          } else if (/(\.tsx?|\.jsx?)$/.test(item)) {
            const metadata = extractComponentMetadata(fullPath);
            files.push({
              name: item,
              path: `lib/${relativePath}${item}`,
              type: 'util',
              modified: stats.mtimeMs,
              exports: metadata.exports,
            });

            updater.log('info', `LIB: ${item}`, `lib/${relativePath}${item}`);
          }
        } catch (err) {
          updater.log('warning', `İşleme hatası: ${err instanceof Error ? err.message : 'Hata'}`, fullPath);
        }
      });
    } catch (err) {
      updater.log('warning', `Lib okunamadı: ${err instanceof Error ? err.message : 'Hata'}`, dir);
    }
  }

  scanDir(LIB_DIR);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

// =============== TEST DOSYALARI TARAMA ===============

function findTestFiles(): FileInfo[] {
  const allFiles = findAllAppFiles();
  return allFiles.filter(f => f.type === 'test');
}

// =============== ROOT DİZİN TARAMA ===============

function findRootFiles(): FileInfo[] {
  const files: FileInfo[] = [];
  
  try {
    const items = fs.readdirSync(PROJECT_ROOT);
    items.forEach((item: string) => {
      if (
        item.startsWith('.') || item.startsWith('node_modules') || item.startsWith('app') ||
        item.startsWith('public') || item.startsWith('lib') || item.startsWith('scripts') ||
        EXCLUDED_ROOT_FILES.includes(item)
      ) {
        return;
      }

      const fullPath = path.join(PROJECT_ROOT, item);
      
      try {
        const stats = fs.statSync(fullPath);

        if (!stats.isDirectory() && /(\.tsx?|\.jsx?)$/.test(item)) {
          files.push({
            name: item,
            path: item,
            type: 'other',
            modified: stats.mtimeMs,
          });

          updater.log('info', `ROOT: ${item}`, item);
        }
      } catch (err) {
        updater.log('warning', `İşleme hatası: ${err instanceof Error ? err.message : 'Hata'}`, fullPath);
      }
    });
  } catch (err) {
    updater.log('error', `Root okunamadı: ${err instanceof Error ? err.message : 'Hata'}`, PROJECT_ROOT);
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

// =============== LİSTE OLUŞTURMA ===============

function generateComponentsList(): string {
  const allFiles = findAllAppFiles();
  const components = allFiles.filter(f => f.type === 'component');

  if (components.length === 0) return '(Henüz component yok)';

  return components
    .map(comp => {
      let info = `- **${comp.name}** - \`${comp.path}\``;
      if (comp.props?.length) {
        const propList = comp.props.map(p => `${p.name}: ${p.type}`).join(', ');
        info += ` | Props: {${propList}}`;
      }
      return info;
    })
    .join('\n');
}

function generateTestFilesList(): string {
  const tests = findTestFiles();

  if (tests.length === 0) return '(Henüz test dosyası yok)';

  return tests.map(test => `- **${test.name}** - \`${test.path}\``).join('\n');
}

function generateRoutesList(): string {
  const allFiles = findAllAppFiles();
  const routes = allFiles.filter(f => f.type === 'route');

  if (routes.length === 0) return '(Henüz API route yok)';

  return routes
    .map(route => {
      const methods = route.methods?.length ? ` (${route.methods.join(', ')})` : '';
      return `- **${route.path}**${methods}`;
    })
    .join('\n');
}

function generateLibFilesList(): string {
  const libFiles = findLibFiles();

  if (libFiles.length === 0) return '(Henüz lib dosyası yok)';

  return libFiles.map(file => `- **${file.name}** - \`${file.path}\``).join('\n');
}

function generateRootFilesList(): string {
  const rootFiles = findRootFiles();

  if (rootFiles.length === 0) return '(Henüz ek dosya yok)';

  return rootFiles.map(file => `- **${file.name}** - \`${file.path}\``).join('\n');
}

function generateArchitectureDiagram(): string {
  const allFiles = findAllAppFiles();
  const components = allFiles.filter(f => f.type === 'component').slice(0, 5);

  if (components.length === 0) return '';

  let diagram = 'graph TD\n';
  diagram += '    Root["🏠 App Layout"]\n';
  
  components.forEach((comp, idx) => {
    const nodeId = `C${idx}`;
    diagram += `    ${nodeId}["📦 ${comp.name}"]\n`;
    diagram += `    Root --> ${nodeId}\n`;
  });

  return '```mermaid\n' + diagram + '```';
}

// =============== GEMINI.MD GÜNCELLEME ===============

function updateGeminiMd(): boolean {
  try {
    if (!fs.existsSync(GEMINI_MD)) {
      updater.log('error', `gemini.md bulunamadı`, GEMINI_MD);
      return false;
    }

    let content = fs.readFileSync(GEMINI_MD, 'utf-8');
    updater.log('info', `gemini.md okundu`);

    const componentsList = generateComponentsList();
    content = updateSection(content, '<!-- AUTO-UPDATE-COMPONENTS -->', '<!-- AUTO-UPDATE-COMPONENTS-END -->', componentsList);

    const testFilesList = generateTestFilesList();
    content = updateSection(content, '<!-- AUTO-UPDATE-TEST-FILES -->', '<!-- AUTO-UPDATE-TEST-FILES-END -->', testFilesList);

    const routesList = generateRoutesList();
    content = updateSection(content, '<!-- AUTO-UPDATE-ROUTES -->', '<!-- AUTO-UPDATE-ROUTES-END -->', routesList);

    const libFilesList = generateLibFilesList();
    content = updateSection(content, '<!-- AUTO-UPDATE-LIB-FILES -->', '<!-- AUTO-UPDATE-LIB-FILES-END -->', libFilesList);

    const rootFilesList = generateRootFilesList();
    content = updateSection(content, '<!-- AUTO-UPDATE-ROOT-FILES -->', '<!-- AUTO-UPDATE-ROOT-FILES-END -->', rootFilesList);

    const diagram = generateArchitectureDiagram();
    if (diagram) {
      content = updateSection(content, '<!-- AUTO-UPDATE-ARCHITECTURE -->', '<!-- AUTO-UPDATE-ARCHITECTURE-END -->', diagram);
    }

    fs.writeFileSync(GEMINI_MD, content, 'utf-8');
    updater.log('info', `gemini.md yazıldı`);

    const totalFiles = findAllAppFiles().length + findLibFiles().length + findRootFiles().length;
    updater.printSummary(totalFiles);
    return true;
  } catch (err) {
    updater.log('error', `Güncelleme hatası: ${err instanceof Error ? err.message : 'Hata'}`, GEMINI_MD);
    updater.printSummary(0);
    return false;
  }
}

// =============== YARDIMCI FONKSİYONLAR ===============

function updateSection(content: string, startMarker: string, endMarker: string, newContent: string): string {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    updater.log('warning', `Marker bulunamadı`, startMarker);
    return content;
  }

  const before = content.substring(0, startIndex + startMarker.length);
  const after = content.substring(endIndex);
  return `${before}\n${newContent}\n${after}`;
}

// =============== BAŞLA ===============

console.log('\n' + '='.repeat(60));
console.log('🔄 GEMINI CONTEXT GÜNCELLEME BAŞLATILIYOR');
console.log('='.repeat(60) + '\n');

const success = updateGeminiMd();
process.exit(success ? 0 : 1);