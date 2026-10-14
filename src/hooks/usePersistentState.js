import { useEffect, useState } from "react";
import { loadLocal, saveLocal } from "../services/dbService";

/**
 * useState that is automatically saved to localStorage under `key`.
 * `migrate` (optional) cleans up the loaded value, e.g. merging in new default settings.
 */
export default function usePersistentState(key, fallbackValue, migrate = (v) => v) {
  const [value, setValue] = useState(() => migrate(loadLocal(key, fallbackValue)));
  useEffect(() => { saveLocal(key, value); }, [key, value]);
  return [value, setValue];
}
