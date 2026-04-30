
import Constants from 'expo-constants';

const PRODUCTION_URL = 'https://fzone-bckend.onrender.com';

const USE_LOCAL_BACKEND = true; 

const getBaseUrl = () => {
  if (USE_LOCAL_BACKEND && __DEV__) {
    const debuggerHost = Constants.expoHostUri || Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    const localhost = debuggerHost?.split(':')[0];
    
    if (localhost) {
      return `http://${localhost}:3001`;
    }
    return 'http://localhost:3001';
  }
  
  return PRODUCTION_URL;
};

export const API_BASE_URL = getBaseUrl();

