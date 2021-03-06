import { Scope, Mutation, Type, GapiObjectType } from '../index';
import {
  GraphQLInt,
  GraphQLScalarType,
  GraphQLNonNull,
  GraphQLObjectType
} from 'graphql';
import { Controller, Container } from '@rxdi/core';
jest.useFakeTimers();

@GapiObjectType()
class UserType {
  readonly id: number | GraphQLScalarType = GraphQLInt;
  name: string;
}

@Controller()
class ClassTestProvider {
  @Scope('ADMIN')
  @Type(UserType)
  @Mutation({
    id: {
      type: new GraphQLNonNull(GraphQLInt)
    }
  })
  mutation(root, { id }, context) {
    return { id: 1 };
  }
}

class TestingMutation {
  resolve: <T>(root, payload, context) => T;
  args: { [key: string]: { type: any } };
  method_type: string;
  method_name: string;
  target: ClassTestProvider;
  type: UserType;
  scope: Array<string>;
}

describe('Decorators: @Mutation', () => {
  it('Should decorate target descriptor with appropriate values', done => {
    const mutation: TestingMutation = <any>(
      Container.get(ClassTestProvider).mutation(null, { id: null }, null)
    );
    expect(JSON.stringify(mutation.args.id.type)).toBe(
      JSON.stringify(new GraphQLNonNull(GraphQLInt))
    );
    expect(mutation.method_name).toBe('mutation');
    expect(mutation.method_type).toBe('mutation');
    expect(Container.get(ClassTestProvider)).toBeInstanceOf(ClassTestProvider);
    expect(mutation.type).toBeInstanceOf(GraphQLObjectType);
    expect(mutation.type.name).toBe('UserType');
    expect(mutation.scope[0]).toBe('ADMIN');
    const returnResult: { id: number } = mutation.resolve(null, {}, null);
    expect(returnResult.id).toBe(1);
    done();
  });
});
