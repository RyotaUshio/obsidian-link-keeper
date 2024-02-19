import { Plugin, TFile, TFolder, normalizePath } from 'obsidian';


export default class LinkKeeperPlugin extends Plugin {
	activeTask: Promise<any> = Promise.resolve();
	failedTasks: (() => Promise<any>)[] = [];

	async onload() {
		this.registerEvent(this.app.vault.on('create', (newFile) => {

			const eventRef = this.app.vault.on('delete', async (oldFile) => {

				if ((oldFile instanceof TFile && newFile instanceof TFile)
					|| (oldFile instanceof TFolder && newFile instanceof TFolder)) {

					const oldPath = oldFile.path;
					const newPath = newFile.path;

					const oldParent = normalizePath(oldPath.split('/').slice(0, -1).join('/')); // TFile.parent is null for a deleted file
					const newParent = newFile.parent?.path;

					if (oldFile.name === newFile.name // moved to a different folder
						|| oldParent === newParent) { // renamed in the same folder

						const newPath = newFile.path;

						const previousTask = this.activeTask;

						const task = async () => {
							await this.app.vault.rename(newFile, oldFile.path);
							await this.app.fileManager.renameFile(newFile, newPath);
						};

						this.activeTask = (async () => {
							await previousTask;
							try {
								await task();

								this.app.vault.offref(eventRef);

								const retryFailedTasks = [];

								while (this.failedTasks.length) {
									const failedTask = this.failedTasks.shift();
									if (!failedTask) continue;
									try {
										await failedTask();
									} catch (e) {
										retryFailedTasks.push(failedTask);
									}
								}

								this.failedTasks.push(...retryFailedTasks);
							} catch (e) {
								this.failedTasks.push(task);
							}
						})();
					}
				}
			});

			window.setTimeout(() => {
				this.app.vault.offref(eventRef);
			}, 500);
		}))
	}
}
