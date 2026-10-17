// scripts/patch-expo-notifications.js
// Prevents Android Expo Go from throwing fatal module load errors or spamming LogBox warnings in SDK 53/57+
const fs = require('fs');
const path = require('path');

// 1. Patch warnOfExpoGoPushUsage to prevent fatal throw
const warnFiles = [
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'warnOfExpoGoPushUsage.js'),
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'src', 'warnOfExpoGoPushUsage.ts'),
];

warnFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("throw new Error(message);")) {
      content = content.replace("throw new Error(message);", "didWarn = true;\n        console.log(message);");
      fs.writeFileSync(file, content, 'utf8');
      console.log(`[Patch] Successfully patched ${file} for Expo Go compatibility.`);
    }
  }
});

// 2. Patch TopicSubscriptionModule.android to prevent "Cannot find native module 'ExpoTopicSubscriptionModule'" in Expo Go
const topicFiles = [
  path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'TopicSubscriptionModule.android.js'),
];

const topicModuleReplacement = `import { requireOptionalNativeModule } from 'expo-modules-core';

const fallbackModule = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

const nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
export default nativeModule || fallbackModule;
`;

topicFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("requireNativeModule('ExpoTopicSubscriptionModule')")) {
      fs.writeFileSync(file, topicModuleReplacement, 'utf8');
      console.log(`[Patch] Successfully patched ${file} for Expo Go topic module fallback.`);
    }
  }
});

// 3. Patch index.js in expo-notifications so Expo Go startup notification warning doesn't spam yellow LogBox banners
const indexFile = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'index.js');
if (fs.existsSync(indexFile)) {
  let content = fs.readFileSync(indexFile, 'utf8');
  if (content.includes("console.warn(message);")) {
    content = content.replace("console.warn(message);", "console.log('[expo-notifications] Notice: ' + message);");
    fs.writeFileSync(indexFile, content, 'utf8');
    console.log(`[Patch] Successfully silenced LogBox warning banner in ${indexFile}.`);
  }
}
