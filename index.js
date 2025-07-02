import express from "express"
import fs from "fs"
import cors from "cors" // Import the cors middleware
import { Zalo } from "zca-js" // Assuming zca-js is installed
import { getShortGroupList } from "./zaloHelper.js" // Assuming zaloHelper.js exists
import { Reactions } from "zca-js";

const app = express()
const PORT = 3000
const COOKIE_PATH = "./cookie.json"
const GROUP_SELECTED_PATH = "./group-selected.json" // New constant for selected groups file

let zaloApi = null
let zalo = null
let currentCookieRaw = null
let currentSelectedGroupsRaw = null // New variable to watch selected groups file

// Enable CORS for all routes
app.use(cors()) // Add this line to enable CORS

// Middleware to parse JSON request bodies
app.use(express.json())

// Cấu hình thiết bị
const imei = "9073d3fa-0aae-4f56-839e-4fd5fc2b6154-d2ad6785d256851dd366703bdc61aa61"
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"

// Khởi tạo lại Zalo client
async function initZalo(cookie) {
  try {
    console.log("🔄 Đang khởi tạo Zalo client...")
    zalo = new Zalo({
      selfListen: false,
      checkUpdate: true,
      logging: false,
    })
    zaloApi = await zalo.login({ cookie, imei, userAgent })
    zaloApi.listener.on("message", (message) => {

        const threadId = message?.threadId
        const type = message?.type
        const { msgId, cliMsgId, idTo } = message.data;
        
        const addReactionDestination = {
            data: { msgId, cliMsgId },
            threadId,
            type
        };
        
        const selectedGroups = readSelectedGroupsFromFile()

        if (!selectedGroups.includes(idTo)) {
            return
          }

        zaloApi.addReaction(Reactions.LIKE, addReactionDestination)
                .then(console.log).catch(console.error);
    });
    zaloApi.listener.start()
    console.log("✅ Zalo đã sẵn sàng")
  } catch (err) {
    console.error("❌ Không thể khởi tạo Zalo:", err)
  }
}

// Theo dõi cookie.json
function watchCookieFile() {
  fs.watchFile(COOKIE_PATH, { interval: 1000 }, async (curr, prev) => {
    try {
      const raw = fs.readFileSync(COOKIE_PATH, "utf-8")
      if (raw !== currentCookieRaw) {
        console.log("🕵️‍♂️ Cookie.json thay đổi, reload Zalo...")
        currentCookieRaw = raw
        const newCookie = JSON.parse(raw)
        await initZalo(newCookie)
      }
    } catch (err) {
      console.error("❌ Lỗi khi đọc cookie:", err)
    }
  })
}

// Helper function to read selected groups from file
function readSelectedGroupsFromFile() {
  try {
    if (!fs.existsSync(GROUP_SELECTED_PATH)) {
      console.log(`ℹ️ ${GROUP_SELECTED_PATH} không tồn tại, tạo file rỗng.`)
      fs.writeFileSync(GROUP_SELECTED_PATH, "[]", "utf-8")
      currentSelectedGroupsRaw = "[]"
      return []
    }
    const raw = fs.readFileSync(GROUP_SELECTED_PATH, "utf-8")
    currentSelectedGroupsRaw = raw // Update raw content for watch comparison
    return JSON.parse(raw)
  } catch (err) {
    console.error(`❌ Lỗi khi đọc ${GROUP_SELECTED_PATH}:`, err)
    return []
  }
}

// Helper function to write selected groups to file
function writeSelectedGroupsToFile(groupIds) {
  try {
    const newRaw = JSON.stringify(groupIds, null, 2)
    if (newRaw !== currentSelectedGroupsRaw) {
      // Only write if content actually changed
      fs.writeFileSync(GROUP_SELECTED_PATH, newRaw, "utf-8")
      currentSelectedGroupsRaw = newRaw // Update raw content after writing
      console.log(`💾 Đã lưu danh sách group ID vào ${GROUP_SELECTED_PATH}`)
    } else {
      console.log(`ℹ️ ${GROUP_SELECTED_PATH} không thay đổi, bỏ qua ghi file.`)
    }
  } catch (err) {
    console.error(`❌ Lỗi khi ghi vào ${GROUP_SELECTED_PATH}:`, err)
  }
}

// Theo dõi group-selected.json
function watchSelectedGroupsFile() {
  fs.watchFile(GROUP_SELECTED_PATH, { interval: 1000 }, (curr, prev) => {
    try {
      const raw = fs.readFileSync(GROUP_SELECTED_PATH, "utf-8")
      if (raw !== currentSelectedGroupsRaw) {
        console.log("🕵️‍♂️ group-selected.json thay đổi bên ngoài, cập nhật trạng thái...")
        currentSelectedGroupsRaw = raw
        // No need to re-read into a variable here, just acknowledge the change
        // The next GET request will read the updated file.
      }
    } catch (err) {
      console.error(`❌ Lỗi khi đọc ${GROUP_SELECTED_PATH} trong watch:`, err)
    }
  })
}

// GET /groups (Existing API)
app.get("/groups", async (req, res) => {
  try {
    if (!zaloApi) return res.status(503).json({ error: "Zalo chưa khởi tạo" })
    const groups = await getShortGroupList(zaloApi)
    res.json(groups)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// NEW API: GET /selected-groups
app.get("/selected-groups", (req, res) => {
  try {
    const selectedGroups = readSelectedGroupsFromFile()
    res.json(selectedGroups)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// NEW API: POST /selected-groups
app.post("/selected-groups", (req, res) => {
  try {
    const { groupIds } = req.body
    if (!Array.isArray(groupIds)) {
      return res.status(400).json({ error: "Yêu cầu không hợp lệ: groupIds phải là một mảng." })
    }

    writeSelectedGroupsToFile(groupIds)
    res.status(200).json({ message: "Danh sách group ID đã được cập nhật thành công." })
  } catch (err) {
    console.error("Lỗi khi xử lý POST /selected-groups:", err)
    res.status(500).json({ error: err.message })
  }
})

// Start server
app.listen(PORT, async () => {
  console.log(`🌐 Server chạy tại http://localhost:${PORT}`)

  // Khởi tạo ban đầu cho cookie
  try {
    const rawCookie = fs.readFileSync(COOKIE_PATH, "utf-8")
    currentCookieRaw = rawCookie
    await initZalo(JSON.parse(rawCookie))
    watchCookieFile() // Bắt đầu theo dõi cookie.json
  } catch (err) {
    console.error("❌ Không thể khởi động do lỗi cookie:", err)
  }

  // Khởi tạo ban đầu cho group-selected.json
  readSelectedGroupsFromFile() // Read once to initialize currentSelectedGroupsRaw and create file if not exists
  watchSelectedGroupsFile() // Bắt đầu theo dõi group-selected.json
})
