import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Simple status monitoring system using custom events
 * This avoids complex context dependencies and circular imports
 */

// Global event target for status communication
const statusEventTarget = new EventTarget();

/**
 * Status types for different operations
 */
export const STATUS_TYPES = {
  // Data operations
  DATA_LOADING: "data_loading",
  DATA_SAVING: "data_saving",
  DATA_DELETING: "data_deleting",

  // API operations
  API_CALL: "api_call",
  FORM_SUBMISSION: "form_submission",
  FILE_UPLOAD: "file_upload",

  // Auth operations
  AUTH_LOGIN: "auth_login",
  AUTH_LOGOUT: "auth_logout",
  AUTH_REFRESH: "auth_refresh",

  // Background operations
  BACKGROUND_TASK: "background_task",
  SYNC_OPERATION: "sync_operation",

  // Network operations
  NETWORK_CHECK: "network_check",
  CONNECTION_TEST: "connection_test",
};

/**
 * Status states
 */
export const STATUS_STATES = {
  IDLE: "idle",
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  ERROR: "error",
  CANCELLED: "cancelled",
};

/**
 * Global registry for active operations
 */
const activeOperations = new Map();
let operationCounter = 0;

/**
 * Dispatch status event
 */
function dispatchStatusEvent(type, data) {
  const event = new CustomEvent("status-operation", {
    detail: { type, ...data },
  });
  statusEventTarget.dispatchEvent(event);
}

/**
 * Hook for data loading operations with status monitoring
 */
export function useDataLoader() {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const loadData = useCallback(async (operationFn) => {
    const operationId = `data_load_${++operationCounter}`;
    operationIdRef.current = operationId;

    setIsActive(true);
    dispatchStatusEvent("start", {
      id: operationId,
      type: STATUS_TYPES.DATA_LOADING,
      description: "Loading data",
    });

    console.log("[useDataLoader] loader called");
    try {
      const result = await operationFn();
      console.log("[useDataLoader] loader result:", result);
      dispatchStatusEvent("complete", { id: operationId });
      return result;
    } catch (error) {
      console.error("[useDataLoader] loader error:", error);
      dispatchStatusEvent("error", { id: operationId, error: error.message });
      throw error;
    } finally {
      setIsActive(false);
    }
  }, []);

  return Object.assign(loadData, { isActive });
}

/**
 * Hook for data saving operations with status monitoring
 */
export function useDataSaver() {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const saveData = useCallback(async (operationFn) => {
    const operationId = `data_save_${++operationCounter}`;
    operationIdRef.current = operationId;

    setIsActive(true);
    dispatchStatusEvent("start", {
      id: operationId,
      type: STATUS_TYPES.DATA_SAVING,
      description: "Saving data",
    });

    try {
      const result = await operationFn();
      dispatchStatusEvent("complete", { id: operationId });
      return result;
    } catch (error) {
      dispatchStatusEvent("error", { id: operationId, error: error.message });
      throw error;
    } finally {
      setIsActive(false);
    }
  }, []);

  return Object.assign(saveData, { isActive });
}

/**
 * Hook for form submissions with status monitoring
 */
export function useFormSubmitter(description = "Submitting form") {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const submitForm = useCallback(
    async (operationFn) => {
      const operationId = `form_submit_${++operationCounter}`;
      operationIdRef.current = operationId;

      setIsActive(true);
      dispatchStatusEvent("start", {
        id: operationId,
        type: STATUS_TYPES.FORM_SUBMISSION,
        description,
      });

      try {
        const result = await operationFn();
        dispatchStatusEvent("complete", { id: operationId });
        return result;
      } catch (error) {
        dispatchStatusEvent("error", { id: operationId, error: error.message });
        throw error;
      } finally {
        setIsActive(false);
      }
    },
    [description]
  );

  return Object.assign(submitForm, { isActive });
}

/**
 * Hook for API calls with status monitoring
 */
export function useApiCaller(description = "API call") {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const callApi = useCallback(
    async (operationFn) => {
      const operationId = `api_call_${++operationCounter}`;
      operationIdRef.current = operationId;

      setIsActive(true);
      dispatchStatusEvent("start", {
        id: operationId,
        type: STATUS_TYPES.API_CALL,
        description,
      });

      try {
        const result = await operationFn();
        dispatchStatusEvent("complete", { id: operationId });
        return result;
      } catch (error) {
        dispatchStatusEvent("error", { id: operationId, error: error.message });
        throw error;
      } finally {
        setIsActive(false);
      }
    },
    [description]
  );

  return Object.assign(callApi, { isActive });
}

/**
 * Hook for file uploads with status monitoring
 */
export function useFileUploader(description = "Uploading file") {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const uploadFile = useCallback(
    async (operationFn) => {
      const operationId = `file_upload_${++operationCounter}`;
      operationIdRef.current = operationId;

      setIsActive(true);
      dispatchStatusEvent("start", {
        id: operationId,
        type: STATUS_TYPES.FILE_UPLOAD,
        description,
      });

      try {
        const result = await operationFn();
        dispatchStatusEvent("complete", { id: operationId });
        return result;
      } catch (error) {
        dispatchStatusEvent("error", { id: operationId, error: error.message });
        throw error;
      } finally {
        setIsActive(false);
      }
    },
    [description]
  );

  return Object.assign(uploadFile, { isActive });
}

/**
 * Hook for background sync operations with status monitoring
 */
export function useSyncOperation(description = "Syncing data") {
  const [isActive, setIsActive] = useState(false);
  const operationIdRef = useRef(null);

  const syncData = useCallback(
    async (operationFn) => {
      const operationId = `sync_${++operationCounter}`;
      operationIdRef.current = operationId;

      setIsActive(true);
      dispatchStatusEvent("start", {
        id: operationId,
        type: STATUS_TYPES.SYNC_OPERATION,
        description,
      });

      try {
        const result = await operationFn();
        dispatchStatusEvent("complete", { id: operationId });
        return result;
      } catch (error) {
        dispatchStatusEvent("error", { id: operationId, error: error.message });
        throw error;
      } finally {
        setIsActive(false);
      }
    },
    [description]
  );

  return Object.assign(syncData, { isActive });
}

/**
 * Hook to listen to global status events
 */
export function useGlobalStatus() {
  const [operations, setOperations] = useState(new Map());

  useEffect(() => {
    const handleStatusEvent = (event) => {
      const { type, id, ...data } = event.detail;

      setOperations((prev) => {
        const newOps = new Map(prev);

        if (type === "start") {
          newOps.set(id, {
            id,
            ...data,
            state: STATUS_STATES.RUNNING,
            startTime: Date.now(),
          });
        } else if (type === "complete") {
          const op = newOps.get(id);
          if (op) {
            newOps.set(id, {
              ...op,
              state: STATUS_STATES.SUCCESS,
              endTime: Date.now(),
            });
          }
        } else if (type === "error") {
          const op = newOps.get(id);
          if (op) {
            newOps.set(id, {
              ...op,
              state: STATUS_STATES.ERROR,
              error: data.error,
              endTime: Date.now(),
            });
          }
        }

        return newOps;
      });
    };

    statusEventTarget.addEventListener("status-operation", handleStatusEvent);

    return () => {
      statusEventTarget.removeEventListener("status-operation", handleStatusEvent);
    };
  }, []);

  const clearCompletedOperations = useCallback(() => {
    setOperations((prev) => {
      const newOps = new Map();
      for (const [id, op] of prev) {
        if (![STATUS_STATES.SUCCESS, STATUS_STATES.ERROR].includes(op.state)) {
          newOps.set(id, op);
        }
      }
      return newOps;
    });
  }, []);

  return { operations, clearCompletedOperations };
}

/**
 * Utility function to wrap database operations with error tracking
 * Use this for operations that don't use the status hooks yet
 */
export function trackDatabaseOperation(operationFn, description = "Database operation") {
  const operationId = `db_op_${++operationCounter}`;

  dispatchStatusEvent("start", {
    id: operationId,
    type: STATUS_TYPES.API_CALL,
    description,
  });

  return operationFn()
    .then((result) => {
      dispatchStatusEvent("complete", { id: operationId });
      return result;
    })
    .catch((error) => {
      dispatchStatusEvent("error", { id: operationId, error: error.message });
      throw error;
    });
}
