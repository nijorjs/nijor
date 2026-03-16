import fs from 'fs';
import path from 'path';

export async function copyFiles(fromDir, toDir) {
  try {
    // Ensure source directory exists
    await fs.promises.access(fromDir);
    
    // Create target directory if it doesn't exist
    await fs.promises.mkdir(toDir, { recursive: true });
    
    // Read all items in source directory
    const items = await fs.promises.readdir(fromDir, { withFileTypes: true });
    
    // Process each item
    const copyPromises = items.map(async (item) => {
      const fromPath = path.join(fromDir, item.name);
      const toPath = path.join(toDir, item.name);
      
      if (item.isDirectory()) {
        // Recursively copy subdirectories
        await copyFiles(fromPath, toPath);
      } else {
        // Copy files
        await fs.promises.copyFile(fromPath, toPath);
      }
    });
    
    // Wait for all copy operations to complete
    await Promise.all(copyPromises);
    
  } catch (error) {console.log(error);}
}