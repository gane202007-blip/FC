require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function promoteAdmin() {
    const email = process.env.ADMIN_PROMOTION_EMAIL?.trim().toLowerCase();
    if (!email) {
        throw new Error("Set ADMIN_PROMOTION_EMAIL to the exact account email.");
    }

    await connectDB();

    try {
        const users = await User.find({ email })
            .select("_id role")
            .limit(2)
            .lean();

        if (users.length !== 1) {
            throw new Error(
                users.length === 0
                    ? "No account found for that email."
                    : "More than one account matched that email; no changes were made."
            );
        }

        if (users[0].role !== "user") {
            throw new Error("The matching account is not currently a user; no changes were made.");
        }

        const result = await User.updateOne(
            { _id: users[0]._id, role: "user" },
            { $set: { role: "admin" } },
            { runValidators: true }
        );

        if (result.modifiedCount !== 1) {
            throw new Error("The account role was not changed; no account fields were modified.");
        }

        console.log("The matching account role was changed to admin.");
    } finally {
        await mongoose.disconnect();
    }
}

promoteAdmin().catch(error => {
    console.error(`Admin promotion failed: ${error.message}`);
    process.exitCode = 1;
});
