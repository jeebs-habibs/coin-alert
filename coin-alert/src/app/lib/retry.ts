// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retryOnServerError(taskFn: () => Promise<any>, retries = 3, delay = 200) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await taskFn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const status = err?.status || err?.response?.status || err?.code

      const isServerError = typeof status === 'number' && status >= 500 && status < 600

      if (!isServerError || attempt === retries) {
        throw err
      }

      console.warn(`Server error (status ${status}). Retrying in ${delay}ms... (attempt ${attempt})`)
      await new Promise(res => setTimeout(res, delay))
      delay *= 2 // Exponential backoff
    }
  }
}
