package com.basharent.manager.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BashaRentMainScreen()
                }
            }
        }
    }
}

@Composable
fun BashaRentMainScreen() {
    var lang by remember { mutableStateOf("bn") }
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = if (lang == "bn") "বাসাভাড়া ম্যানেজার (BashaRent Manager)" else "BashaRent Manager",
                style = MaterialTheme.typography.titleLarge
            )
            OutlinedButton(onClick = { lang = if (lang == "bn") "en" else "bn" }) {
                Text(if (lang == "bn") "English" else "বাংলা")
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = if (lang == "bn")
                "অফলাইন SQLite/Room লেজার সক্রিয় (Asia/Dhaka) · মাসিক ভাড়া, মিটার বিল, পিডিএফ রসিদ ও AES-256-GCM এনক্রিপ্টেড ব্যাকআপ।"
            else
                "Offline SQLite/Room Ledger Active (Asia/Dhaka) · Monthly Rent, Meter Bills, PDF Receipts & AES-256-GCM Encrypted Backup.",
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
