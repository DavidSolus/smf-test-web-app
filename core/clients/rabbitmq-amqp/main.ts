import {EventEmitter} from 'events';
import {Logger} from '../logger';
import {getConnection} from './rabbitmq-connection';

const RMQ_EXCHANGE_NAME = 'smf-events';

export default class Main extends EventEmitter {
  private config: any;
  private connection: any;
  private channel: any;

  constructor(config: any) {
    super();
    this.config = config;
  }

  async start() {
    console.debug('rabbitmq-ampq start');
    this.connection = await getConnection(this.config);

    const channel = await this.connection.createChannel();
    await channel.assertExchange(RMQ_EXCHANGE_NAME, "topic", { durable: false });

    this.channel = channel;
  }

  public publish(route: any, message: any) {
    // (check if relevant, ref: https://github.com/squaremo/amqp.node/blob/master/examples/tutorials/send.js)
    // NB: `sentToQueue` and `publish` both return a boolean
    // indicating whether it's OK to send again straight away, or
    // (when `false`) that you should wait for the event `'drain'`
    // to fire before writing again.

    const data = JSON.stringify(message);
    this.channel.publish(RMQ_EXCHANGE_NAME, route, Buffer.from(data));
    Logger.debug(`MessageBroker: sent ${message.toString()}`);
  }

  public async subscribe(route: any) {
    const q = await this.channel.assertQueue("", { exclusive: true });
    await this.channel.bindQueue(q.queue, RMQ_EXCHANGE_NAME, route);

    this.channel.consume(
      q.queue,
      (msg: any) => {
        Logger.debug(`MessageBroker: received ${msg.content.toString()}`);
        const data = JSON.parse(msg.content);
        this.emit("message", { route: msg.fields.routingKey, data });
      },
      { noAck: true },
    );
  }

  public async subscribeAll(routes: any) {
    for (const route of routes) {
      await this.subscribe(route);
    }

  }
}
