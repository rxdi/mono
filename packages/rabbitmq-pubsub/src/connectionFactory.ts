import * as amqp from "amqplib";
import { createChildLogger, Logger } from "./childLogger";

export interface IRabbitMqConnectionFactory {
  create(): Promise<amqp.Connection>;
}

export interface IRabbitMqConnectionConfig {
  host: string;
  port: number;
}

function isConnectionConfig(
  config: IRabbitMqConnectionConfig | string
): config is IRabbitMqConnectionConfig {
  if (
    (config as IRabbitMqConnectionConfig).host &&
    (config as IRabbitMqConnectionConfig).port
  ) {
    return true;
  }
}

export class RabbitMqConnectionFactory implements IRabbitMqConnectionFactory {
  private connection: string;
  connect;
  constructor(
    private logger: Logger,
    config: IRabbitMqConnectionConfig | string
  ) {
    this.connection = isConnectionConfig(config)
      ? `amqp://${config.host}:${config.port}`
      : config;
    this.logger = createChildLogger(logger, "RabbitMqConnectionFactory");
  }

  create(): Promise<amqp.Connection> {
    this.logger.debug("connecting to %s", this.connection);
    if (this.connect) {
      return Promise.resolve(this.connect);
    }
    return Promise.resolve(amqp.connect(this.connection))
    .then((connect) => {
      this.connect = connect;
      return connect;
    })
    .catch((err) => {

      this.logger.error("failed to create connection '%s'", this.connection);
      return Promise.reject(err);
    });
  }
}

export class RabbitMqSingletonConnectionFactory
  implements IRabbitMqConnectionFactory {
  private connection: string;
  private promise: Promise<amqp.Connection>;
  constructor(
    private logger: Logger,
    config: IRabbitMqConnectionConfig | string
  ) {
    this.connection = isConnectionConfig(config)
      ? `amqp://${config.host}:${config.port}`
      : config;
  }

  create(): Promise<amqp.Connection> {
    if (this.promise) {
      this.logger.trace("reusing connection to %s", this.connection);
      return this.promise;
    }
    this.logger.debug("creating connection to %s", this.connection);
    return (this.promise = Promise.resolve(amqp.connect(this.connection)));
  }
}
