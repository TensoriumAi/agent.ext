import { desktopCapturer, screen } from 'electron';

export interface ComputerVisionService {
  getScreenshot: () => Promise<string>;
}

export const computerVisionService: ComputerVisionService = {
  getScreenshot: async (): Promise<string> => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });
    const primarySource = sources[0];

    if (primarySource) {
      const screenshot = primarySource.thumbnail;
      const base64Image = screenshot.toPNG().toString('base64');
      return base64Image;
    }
    throw new Error('No display found for screenshot');
  }
};
