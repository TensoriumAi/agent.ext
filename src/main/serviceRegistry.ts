import log from 'electron-log';

type ServiceType = any; // We'll use a generic type since specific interfaces are now in their own files

interface ServiceInfo {
  name: string;
  functions: string[];
}

class ServiceRegistry {
  private services: Map<string, ServiceType> = new Map();

  register(name: string, service: ServiceType) {
    this.services.set(name, service);
    const functions = this.getFunctions(service);
    log.info(`Registered service: ${name} with functions: ${functions.join(', ')}`);
  }

  private getFunctions(service: ServiceType): string[] {
    if (typeof service !== 'object' || service === null) {
      return [];
    }

    return Object.keys(service).filter(key => typeof service[key] === 'function');
  }

  get<T extends ServiceType>(name: string): T | undefined {
    return this.services.get(name) as T | undefined;
  }

  getAll(): ServiceInfo[] {
    return Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      functions: this.getFunctions(service)
    }));
  }
}

export const serviceRegistry = new ServiceRegistry();
