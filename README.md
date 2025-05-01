# Quvox App

Quvox is a powerful desktop application for taking, organizing, and mapping screenshots into flows. It provides an intuitive interface for creating visual workflows and documentation.
Visual Organization
Curate and organize UI screenshots with smart categorization and tagging and flowing.

Real Interfaces
Explore a vast collection of real desktop application interfaces and patterns.

Design Smarter
Learn from existing solutions and create better desktop experiences.

Visit our website: [quvox.app](https://quvox.app)

## Features

- Screenshot capture and organization
- Flow creation and mapping
- Visual workflow documentation
- Cross-platform support (Windows & iOS)

## Installation

You can download the latest release for your platform from our [Releases](https://github.com/irlfarmer/quvox-app/releases) page.

### Supported Platforms
- Windows
- iOS (coming soon)

## Environment Setup

To run the app locally for development, you'll need to set up the following environment variables:

```env
# Supabase Configuration
# Supabase Configuration (optional - defaults set in config.ts)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
SCREENSHOT_STORAGE_PATH=C:/Users/YourUser/AppData/Local/Deskbin/Screenshots
DEFAULT_CAPTURE_INTERVAL=30000 # in milliseconds (optional)

# Feature Flags
ENABLE_DEBUG_MODE=false # defaults to true in development 


# App Configuration
APP_URL=http://localhost:3000
```

## Development

1. Clone the repository:
```bash
git clone https://github.com/irlfarmer/quvox-app.git
cd quvox-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run start
```

## Building

To build the application:

```bash
npm run make
```

The built application will be available in the `out` directory.

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## License

This project is licensed under the Attribution-NonCommercial-ShareAlike 4.0 International License - see the [LICENSE](LICENSE) file for details.

### Attribution Requirements

Any use of any part of this codebase must be fully attributed to Quvox. This includes:
- Maintaining all copyright notices
- Providing a link to the original source
- Indicating if changes were made
- Including a copy of the license

## Support

For support, please visit [quvox.app](https://quvox.app) or open an issue in this repository. 