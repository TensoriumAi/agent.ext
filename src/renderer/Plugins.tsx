import React, { useEffect, useState } from 'react';
import { Box, VStack, Text, Heading, Button, Divider } from '@chakra-ui/react';

interface Plugin {
  name: string;
}

interface Service {
  name: string;
  functions: string[];
}

export function Plugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [services, setServices] = useState<Array<{ name: string; functions: string[] }>>([]);

  const fetchPlugins = () => {
    window.electron.ipcRenderer.sendMessage('get-plugins');
  };

  const fetchServices = async () => {
    try {
      const fetchedServices = await window.electron.ipcRenderer.invoke('get-services');
      setServices(fetchedServices);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  useEffect(() => {
    fetchPlugins();
    fetchServices();

    const removePluginListener = window.electron.ipcRenderer.on('get-plugins-response', (installedPlugins) => {
      console.log('Received plugins:', installedPlugins);
      setPlugins(installedPlugins as Plugin[]);
    });

    const removeServiceListener = window.electron.ipcRenderer.on('get-services-response', (registeredServices) => {
      console.log('Received services:', registeredServices);
      setServices(registeredServices as Service[]);
    });

    return () => {
      removePluginListener();
      removeServiceListener();
    };
  }, []);

  const handleInstallPlugin = () => {
    window.electron.ipcRenderer.sendMessage('install-plugin');
  };

  useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on('install-plugin-response', (success) => {
      if (success) {
        fetchPlugins();
      }
    });

    return () => {
      removeListener();
    };
  }, []);

  return (
    <VStack spacing={4} align="stretch">
      <Heading size="md">Installed Plugins</Heading>
      {plugins.map((plugin, index) => (
        <Box key={index} p={3} borderWidth={1} borderRadius="md">
          <Text>{plugin.name}</Text>
        </Box>
      ))}
      <Button onClick={handleInstallPlugin}>Install Plugin</Button>

      <Divider my={4} />

      <Heading size="md">Registered Services</Heading>
      {services.map((service, index) => (
        <Box key={index} p={3} borderWidth={1} borderRadius="md">
          <Text>{service.name}</Text>
          <ul>
            {service.functions.map((func) => (
              <li key={func}>{func}</li>
            ))}
          </ul>
        </Box>
      ))}
    </VStack>
  );
}
