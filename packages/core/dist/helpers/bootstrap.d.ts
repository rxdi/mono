import 'reflect-metadata';
import { ConfigModel } from '../services/config/config.model';
import { Observable } from 'rxjs';
import { ModuleArguments } from '../decorators/module/module.interfaces';
import { ObservableContainer } from '../container/observable-interface';
export declare const Bootstrap: (app: any, config?: ConfigModel) => Observable<ObservableContainer>;
export declare const BootstrapPromisify: (app: any, config?: ConfigModel) => Promise<ObservableContainer>;
export declare const BootstrapFramework: (app: any, modules: any[], config?: ConfigModel) => Observable<ObservableContainer>;
export declare const setup: <T, K>(options: ModuleArguments<T, K>, frameworks?: any[], bootstrapOptions?: ConfigModel) => Observable<ObservableContainer>;
export declare const createTestBed: <T, K>(options: ModuleArguments<T, K>, frameworks?: any[], bootstrapOptions?: ConfigModel) => Observable<ObservableContainer>;