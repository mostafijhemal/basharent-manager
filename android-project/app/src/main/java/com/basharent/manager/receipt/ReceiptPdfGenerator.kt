package com.basharent.manager.receipt

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import java.io.File
import java.io.FileOutputStream

object ReceiptPdfGenerator {
    fun generateReceiptPdf(
        context: Context,
        receiptNumber: String,
        tenantName: String,
        buildingAndUnit: String,
        amountFormatted: String,
        paymentDate: String
    ): File {
        val doc = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
        val page = doc.startPage(pageInfo)
        val canvas: Canvas = page.canvas
        val paint = Paint().apply {
            color = Color.BLACK
            textSize = 16f
            isAntiAlias = true
        }

        canvas.drawText("BashaRent Manager — Official Rent Receipt", 40f, 60f, paint)
        canvas.drawText("Receipt #: $receiptNumber", 40f, 100f, paint)
        canvas.drawText("Date: $paymentDate", 40f, 130f, paint)
        canvas.drawText("Tenant: $tenantName", 40f, 160f, paint)
        canvas.drawText("Unit: $buildingAndUnit", 40f, 190f, paint)
        canvas.drawText("Total Received: $amountFormatted", 40f, 230f, paint)

        doc.finishPage(page)
        val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
        val file = File(dir, "Receipt_$receiptNumber.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }
}
