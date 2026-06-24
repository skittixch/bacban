const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = process.env.DATA_FILE || "/data/kanban-data.json";

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Ensure data directory exists
async function ensureDataFile() {
  try {
    const dir = path.dirname(DATA_FILE);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(DATA_FILE);
    } catch {
      // File doesn't exist, create with default data
      const defaultData = {
        boards: {
          work: {
            title: "Work",
            tasks: { todo: [], inprogress: [], done: [] },
            columnOrder: ["todo", "inprogress", "done"],
            columnTitles: {
              todo: "To Do",
              inprogress: "In Progress",
              done: "Done",
            },
            collapsed: false,
            height: 400,
          },
          life: {
            title: "Life",
            tasks: { todo: [], inprogress: [], done: [] },
            columnOrder: ["todo", "inprogress", "done"],
            columnTitles: {
              todo: "Personal",
              inprogress: "Doing",
              done: "Completed",
            },
            collapsed: false,
            height: 400,
          },
        },
        theme: "blue",
        darkMode: false,
        boardOrder: ["work", "life"],
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
    }
  } catch (error) {
    console.error("Error ensuring data file:", error);
  }
}

// Read data
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading data:", error);
    return null;
  }
}

// Write data
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing data:", error);
    return false;
  }
}

// GET all data
app.get("/api/data", async (req, res) => {
  const data = await readData();
  if (data) {
    res.json(data);
  } else {
    res.status(500).json({ error: "Failed to read data" });
  }
});

// POST update all data
app.post("/api/data", async (req, res) => {
  const success = await writeData(req.body);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to write data" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Initialize and start server
ensureDataFile().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kanban API running on port ${PORT}`);
    console.log(`Data file: ${DATA_FILE}`);
  });
});
