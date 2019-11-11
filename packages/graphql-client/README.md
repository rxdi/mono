# Graphql module for client side rxdi application build with Apollo-graphql

#### Install
```bash
npm i @rxdi/graphql-client
```

#### Define routes with forRoot these will be evaluated lazy

```typescript
import { Module } from '@rxdi/core';
import { AppComponent } from './app.component';
import { GraphqlModule } from '@rxdi/graphql-client';
import { DOCUMENTS } from './@introspection/documents';

@Module({
  imports: [
    GraphqlModule.forRoot({
      async onRequest(this: GraphQLRequest) {
        const headers = new Headers();
        headers.append('authorization', '');
        return headers;
      },
      uri: 'http://localhost:9000/graphql',
      pubsub: 'ws://localhost:9000/subscriptions',
    }, DOCUMENTS),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```


#### Base component
```typescript

import { Injector } from '@rxdi/core';
import { DocumentTypes } from '../@introspection/documentTypes';
import { from, Observable } from 'rxjs';
import { IQuery, IMutation, ISubscription } from '../@introspection';
import { LitElement } from '@rxdi/lit-html';
import { importQuery, ApolloClient, QueryOptions, SubscriptionOptions, MutationOptions, DataProxy } from '@rxdi/graphql-client';

export class BaseComponent extends LitElement {
  @Injector(ApolloClient)
  public graphql: ApolloClient;

  query<T = IQuery>(options: ImportQueryMixin) {
    options.query = importQuery(options.query);
    return from(this.graphql.query.bind(this.graphql)(
      options
    ) as any) as Observable<{ data: T }>;
  }

  mutate<T = IMutation>(options: ImportMutationMixin) {
    options.mutation = importQuery(options.mutation);
    return from(this.graphql.mutate.bind(this.graphql)(
      options
    ) as any) as Observable<{ data: T }>;
  }

  subscribe<T = ISubscription>(options: ImportSubscriptionMixin) {
    options.query = importQuery(options.query);
    return from(this.graphql.subscribe.bind(this.graphql)(
      options
    ) as any) as Observable<{ data: T }>;
  }
}

interface ImportQueryMixin extends QueryOptions {
  query: DocumentTypes;
}

interface ImportSubscriptionMixin extends SubscriptionOptions {
  query: DocumentTypes;
}

interface ImportMutationMixin extends MutationOptions {
  mutation: DocumentTypes;
  update?(proxy: DataProxy, res: {data: IMutation}): void;
}

```


#### Usage

```typescript
import { Component, html, css, async } from '@rxdi/lit-html';
import { BaseComponent } from '../../shared/base.component';
import { RouteParams } from '@rxdi/router';
import { map } from 'rxjs/operators';

@Component({
  selector: 'project-details-component',
  style: css`
    .container {
      width: 1000px;
    }
  `,
  template(this: DetailsComponent) {
    return html`
      <div class="container">
        <card-component>
          <div slot="content">
            ${async(this.getProject())}
          </div>
        </card-component>
      </div>
    `;
  }
})
export class DetailsComponent extends BaseComponent {
  @RouteParams()
  private params: { projectName: string };

  getProject() {
    return this.query({
      query: 'get-project.query.graphql',
      variables: {
        name: this.params.projectName
      }
    }).pipe(
      map(res => res.data.getProject),
      map(
        res => html`
          <project-item-component
            createdAt=${res.createdAt}
            id=${res.id}
            name=${res.name}
            ownedBy=${res.ownedBy}
          ></project-item-component>
        `
      ),
    );
  }
}
```