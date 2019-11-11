import { InjectionToken } from '@rxdi/core';
import { ApolloClient as AC } from 'apollo-client';
import { NormalizedCacheObject } from 'apollo-cache-inmemory';

export const ApolloClient = new InjectionToken<AC<NormalizedCacheObject>>(
  'apollo-link'
);
export interface ApolloClient extends AC<NormalizedCacheObject> {}

export const GraphqlDocuments = 'graphql-documents';

export interface GraphqlModuleConfig {
  uri: string;
  pubsub: string;
  onRequest?(): Promise<Headers>;
}
export const noopHeaders = () => new Headers();
export const noop = () => null;

