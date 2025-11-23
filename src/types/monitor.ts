import { Browser, BrowserContext, Page, Cookie } from 'playwright';

export interface ServerConfig extends MonitorConfig {
  rootPath: string;
  port: number;
  newWindow?: boolean; // whether to open a new terminal window to start the server
}
export interface MonitorConfig {
  cacheDir: string;
  headless?: boolean;
  timeout?: number | undefined;
  debug?: boolean;
  openDevtools?: boolean;
  viewport?: string | null;
  windowPosition?: string | null;
  urls?: string[];
  url?: string;
  authFilePath?: string;
  auth?: Record<string, AuthAccount>;
  authWithoutHost?: AuthAccount; // auth without host, will be applied to all urls if set
  cookie?: Cookie[];
  authSites?: string[];
  networkFilterPatterns?: RegExp[];
  cookiesShouldBeSaved?: string[];
  exitOnError?: boolean;
}

export interface AuthAccount {
  user?: string;
  phone?: string;
  pwd?: string;
  password?: string;
}

export interface SettingItem {
  value: any;
  description?: string;
  type?: string;
}

export interface Settings {
  [key: string]: SettingItem;
}

export interface TempState {
  targetUrl: string;
}

export interface LoginAdaptor {
  pattern: RegExp;
  adaptor: (page: Page, account: AuthAccount) => Promise<string>;
}

export interface ScreenshotOptions {
  selector?: string[];
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ScreenshotResult {
  success: boolean;
  filename?: string;
  filepath?: string;
  timestamp?: number;
  url?: string;
  selector?: string[] | null;
  elementInfo?: ElementInfo;
  error?: string;
}

export interface ElementInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
}

export interface ActionCoordinator {
  x: number;
  y: number;
}

export interface Action {
  type: 'fill-form' | 'javascript' | 'cursor-click' | 'cursor-move' | 'get-html';
  selectors?: string[];
  interval?: number;
  value?: string;
  code?: string;
  coordinator?: ActionCoordinator;
}

export interface ActionResult {
  status: 'success' | 'failed';
  result?: any;
}

export interface InitializeBrowserOptions {
  onAllPagesClosed?: () => Promise<void>;
}

