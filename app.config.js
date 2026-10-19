module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ??
        config.android?.googleServicesFile ??
        './google-services.json',
    },
  };
};
