class TaskQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private queue: (() => Promise<any>)[] = [];
  private name: string;
  private isProcessing = false;
  private requestInterval: number;

  constructor(maxRequestsPerSecond: number, name: string = "") {
    if (maxRequestsPerSecond <= 0) {
      throw new Error('maxRequestsPerSecond must be greater than 0');
    }
    this.name = name
    this.requestInterval = 1000 / maxRequestsPerSecond; // Delay between requests in ms
  }

  addTask<T>(task: () => Promise<T>, message?: string): Promise<T> {
    if (message) {
      //console.log(message)
    }
    return new Promise((resolve, reject) => {
      //console.log(`🔹 Task added to queue. Queue length: ${this.queue.length + 1}`);

      // Store the task reference without calling it
      this.queue.push(() => task().then(resolve).catch(reject));

      // Ensure the queue starts processing if it’s not already
      if (!this.isProcessing) {
        //console.log("Initiating queue processing")
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.isProcessing) return; // Prevent multiple processors from running
    this.isProcessing = true;

    //console.log("Processing queue")
    // let recordsProcessed = 0
    // let initialTime = Date.now()
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          //console.log(`Processing task`);
          //const beforeTaskTime = Date.now()
          task();
          // recordsProcessed++
          // if(Date.now() - initialTime >= 1000){
          //   //console.log(`Processed ${recordsProcessed} records in ${(Date.now() - initialTime) / 1000} seconds.`)
          //   recordsProcessed = 0
          //   initialTime = Date.now()
          // }
          // const afterTaskTime = Date.now()
          // console.log("Processed task in " + (afterTaskTime - beforeTaskTime)/1000 + " seconds.")
        } catch (error) {
          console.error(`❌ Error processing task:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, this.requestInterval));
      }
    }

    //console.log(`✅ Queue is empty. Processing stopped.`);
    this.isProcessing = false;
  }
}

// Export as a singleton so all files share the same queue
export const blockchainTaskQueue = new TaskQueue(30);

export const heliusPoolQueue = new TaskQueue(3);

