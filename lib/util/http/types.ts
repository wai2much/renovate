import type { IncomingHttpHeaders } from 'node:http';
import type {
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  ParseJsonFunction,
} from 'got';
import type { HttpCacheProvider } from './cache/types';

export type GotContextOptions = { authType?: string } & Record<string, unknown>;

// TODO: Move options to context
export type GotOptions = GotBufferOptions | GotJSONOptions;
export type GotBufferOptions = OptionsOfBufferResponseBody & GotExtraOptions;
export type GotJSONOptions = OptionsOfJSONResponseBody & GotExtraOptions;

export interface GotExtraOptions {
  abortOnError?: boolean;
  abortIgnoreStatusCodes?: number[];
  token?: string;
  hostType?: string;
  enabled?: boolean;
  memCache?: boolean;
  noAuth?: boolean;
  context?: GotContextOptions;
}

export interface RequestStats {
  method: string;
  url: string;
  duration: number;
  queueDuration: number;
  statusCode: number;
}

export type OutgoingHttpHeaders = Record<string, string | string[] | undefined>;

export type GraphqlVariables = Record<string, unknown>;

export interface GraphqlOptions {
  variables?: GraphqlVariables;
  paginate?: boolean;
  count?: number;
  limit?: number;
  cursor?: string | null;
  acceptHeader?: string;
  token?: string;
  readOnly?: boolean;
}

export interface HttpOptions {
  body?: any;
  username?: string;
  password?: string;
  baseUrl?: string;
  headers?: OutgoingHttpHeaders;

  /**
   * Do not use authentication
   */
  noAuth?: boolean;

  throwHttpErrors?: boolean;

  token?: string;
  memCache?: boolean;
  cacheProvider?: HttpCacheProvider;
  readOnly?: boolean;
}

export interface InternalHttpOptions extends HttpOptions {
  json?: HttpOptions['body'];
  responseType?: 'json' | 'buffer';
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head';
  parseJson?: ParseJsonFunction;
}

export interface HttpHeaders extends IncomingHttpHeaders {
  link?: string | undefined;
}

export interface HttpResponse<T = string> {
  statusCode: number;
  body: T;
  headers: HttpHeaders;
  authorization?: boolean;
}

export type Task<T> = () => Promise<T>;
export type GotTask<T> = Task<HttpResponse<T>>;

export interface ThrottleLimitRule {
  matchHost: string;
  throttleMs: number;
}

export interface ConcurrencyLimitRule {
  matchHost: string;
  concurrency: number;
}
