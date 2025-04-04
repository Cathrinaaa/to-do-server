import express from 'express';
import db  from './db.js'; 
import cors from 'cors';

const app = express();
app.use(cors());
// parse json
app.use(express.json());
const PORT = 3000;

//get-titles
app.get('/get-titles', async (req, res) => {
    try {
        const query = "SELECT * FROM titles ORDER BY date_modified DESC";
        const result = await db.query(query);

        // Separate tasks based on status
        const titles = result.rows.map(task => ({
            ...task,
            done: task.status === true // Convert to boolean
        }));

        res.status(200).json({ titles });
    } catch (error) {
        console.error("Error fetching titles:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/add-user', (req, res) => {
    const { username, password, fname, lname } = req.body;
    
    const tquery = "INSERT INTO accounts (username, password, fname, lname) VALUES ($1, $2, $3, $4)";
        
    db.query(tquery, [username, password, fname, lname], (err, tResult) => {
        if (err) return res.status(500).json({ success: false, message: "Something went wrong" });
        
        res.json({ success: true, message: "User Successfully Added" });
    });
});

app.post('/check-user', (req, res) => {
    const { username , password } = req.body;



    const query = "SELECT * FROM accounts WHERE username =$1 AND password=$2";

    db.query(query, [username, password])
    .then(result => {
        
        if (result.rowCount > 0){
            res.status(200).json({ exist: true, message: "Login Successful" });
        } else {
            res.status(200).json({ exist: false, message: "Invalid username or password" });
        }
    })
    .catch(error => {
        console.error("Database error:", error);
        res.status(500).json({ exist: false, message: "Server error" });
    });
});

app.post('/add-to-do', (req, res) => {
    const { username, title, lists } = req.body;
    const status = false;
    const date_modified = new Date().toISOString().split('T')[0];;
    
    const tquery = "INSERT INTO titles (username, title, date_modified, status) VALUES ($1, $2, $3, $4) RETURNING id";
        
    db.query(tquery, [username, title, date_modified, status], (err, tResult) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to add title" });
        const title_id = tResult.rows[0].id;
        const listquery = "INSERT INTO lists (title_id, list_desc, status) VALUES ($1, $2, $3)";
    
        lists.forEach(list_desc => db.query(listquery, [title_id, list_desc, status]));
        
        res.json({ success: true, message: "Successfully Added" });
    });
});

app.post("/add-list-item", async (req, res) => {
  const { title_id, list_desc } = req.body;

  try {
    const result = await db.query(
      "INSERT INTO lists (title_id, list_desc, status) VALUES ($1, $2, false) RETURNING *",
      [title_id, list_desc]
    );

    res.json({ success: true, id: result.rows[0].id, message: "Item added successfully" });
  } catch (error) {
    console.error("Error adding list item:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.post('/delete-to-do', (req, res) => {
    const { title_id } = req.body;

    const deleteListsQuery = "DELETE FROM lists WHERE title_id = $1";
    const deleteTitleQuery = "DELETE FROM titles WHERE id = $1";

    db.query(deleteListsQuery, [title_id], (err) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to delete lists" });

        db.query(deleteTitleQuery, [title_id], (err) => {
            if (err) return res.status(500).json({ success: false, message: "Failed to delete title" });

            res.json({ success: true, message: "To-do Successfully deleted" });
        });
    });
});

// DELETE list item by ID
app.delete("/delete-list-item/:id", async (req, res) => {
    const { id } = req.params;
  
    try {
      const result = await db.query("DELETE FROM lists WHERE id = $1 RETURNING *", [id]);
  
      if (result.rowCount > 0) {
        res.json({ success: true, message: "List item deleted successfully" });
      } else {
        res.status(404).json({ success: false, message: "List item not found" });
      }
    } catch (error) {
      console.error("Error deleting list item:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  });

app.post('/update-status', async (req, res) => {
    const { title_id, id, status } = req.body;
    try {
        await db.query("UPDATE lists SET status = $1 WHERE title_id = $2 AND id = $3", [status, title_id, id]);

        const result = await db.query("SELECT status FROM lists WHERE title_id = $1", [title_id]);
        const allCompleted = result.rows.every(list => list.status === true);

        await db.query("UPDATE titles SET status = $1 WHERE id = $2", [allCompleted, title_id]);

        res.json({ success: true, message: "List Status Successfully Updated" });
    } catch (err) {
        console.error("Error updating status:", err);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
});

app.post("/update-title", async (req, res) => {
    const { title_id, title } = req.body;
  
    try {
      // Update the task title in the database
      const result = await db.query(
        "UPDATE title SET title = $1 WHERE id = $2 RETURNING *",
        [title, title_id]
      );
  
      if (result.rows.length > 0) {
        res.json({ success: true, task: result.rows[0] });
      } else {
        res.status(404).json({ success: false, message: "Task not found" });
      }
    } catch (error) {
      console.error("Error updating task title:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

/* app.post('/update-task', (req, res) => {
    const { id, done } = req.body;
    const updateQuery = "UPDATE titles SET status = $1 WHERE id = $2";

    db.query(updateQuery, [done, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to update task" });

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        res.json({ success: true, message: "Task updated successfully" });
    });
}); */

app.post('/update-to-do', (req, res) => {
    const { title_id, lists } = req.body;

    const deleteListsQuery = "DELETE FROM lists WHERE title_id = $1";

    db.query(deleteListsQuery, [title_id], (err) => {
        if (err) return res.status(500).json({ success: false, message: "Failed to update lists" });

        const insertListQuery = "INSERT INTO lists (title_id, list_desc, status) VALUES ($1, $2, $3)";
        const status = true;

        lists.forEach(list_desc => {
            db.query(insertListQuery, [title_id, list_desc, status]);
        });

        res.json({ success: true, message: "To-do successfully updated" });
    });
});

//jay agala ti list ti specific task etyy
app.get("/get-task-list/:taskId", (req, res) => {
    const taskId = req.params.taskId;
    const query = "SELECT id, list_desc, status FROM lists WHERE title_id = $1"; // Include id in the query
  
    db.query(query, [taskId])
      .then((results) => {
        const formattedList = results.rows.map(item => ({
          id: item.id, // Ensure id is included
          list_desc: item.list_desc,
          status: Boolean(item.status)
        }));
  
        res.json({ list: formattedList });
      })
      .catch((err) => {
        console.error("Error fetching task list:", err);
        res.status(500).json({ error: "Error fetching task list" });
      });
  });

  // Title updates
app.post("/update-task-title", async (req, res) => {
  const { id, title } = req.body;

  try {
      const result = await db.query(
          "UPDATE titles SET title = $1, date_modified = CURRENT_DATE WHERE id = $2 RETURNING *",
          [title, id]
      );
  
      if (result.rows.length > 0) {
          res.json({ success: true, task: result.rows[0] });
      } else {
          res.status(404).json({ success: false, message: "Task not found" });
      }
  } catch (error) {
      console.error("Error updating task title:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update list item description
app.post("/update-list-item", async (req, res) => {
  const { id, list_desc } = req.body;

  try {
      // First get the title_id before updating
      const getResult = await db.query(
          "SELECT title_id FROM lists WHERE id = $1",
          [id]
      );

      if (getResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: "List item not found" });
      }

      const title_id = getResult.rows[0].title_id;

      // Update the list item
      const updateResult = await db.query(
          "UPDATE lists SET list_desc = $1 WHERE id = $2 RETURNING *",
          [list_desc, id]
      );

      // Update the title's modification date
      await db.query(
          "UPDATE titles SET date_modified = CURRENT_DATE WHERE id = $1",
          [title_id]
      );

      res.json({ 
          success: true, 
          item: updateResult.rows[0],
          message: "List item updated successfully" 
      });
  } catch (error) {
      console.error("Error updating list item:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.listen(PORT,() => {
    console.log(`Server is running on Port ${PORT}`);
});