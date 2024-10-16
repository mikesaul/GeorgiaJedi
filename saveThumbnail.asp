<%
Dim jsonString, imageData, fileName, folderPath, binaryData
Dim objStream, binaryStream, json, xml, node

On Error Resume Next ' To catch errors

' Read JSON from the POST request
Set objStream = Server.CreateObject("Adodb.Stream")
objStream.Type = 1 ' Binary
objStream.Mode = 3 ' Read/Write
objStream.Open
objStream.Write Request.BinaryRead(Request.TotalBytes)
objStream.Position = 0
objStream.Type = 2 ' Change to text
jsonString = objStream.ReadText

' Log JSON data for debugging
LogMessage "JSON Received: " & jsonString

' Parse JSON
Set json = Server.CreateObject("ScriptControl")
json.Language = "JScript"
json.Eval "var data = " & jsonString

imageData = json.Eval("data.imageData")
fileName = json.Eval("data.fileName")

' Log extracted data
LogMessage "Image Data Length: " & Len(imageData)
LogMessage "File Name: " & fileName

' Strip the base64 prefix if present
imageData = Replace(imageData, "data:image/jpeg;base64,", "")
imageData = Replace(imageData, "data:image/png;base64,", "")

' Convert base64 to binary
Set binaryStream = Server.CreateObject("Adodb.Stream")
binaryStream.Type = 1 ' Binary
binaryStream.Mode = 3
binaryStream.Open
binaryStream.Write DecodeBase64(imageData)

' Save the file to the images/thumbs directory
folderPath = Server.MapPath("/images/thumbs/") & "\" & fileName
LogMessage "Saving file to: " & folderPath

' Attempt to save the file
On Error Resume Next ' Ignore save errors
binaryStream.SaveToFile folderPath, 2 ' Save with overwrite

If Err.Number <> 0 Then
    LogMessage "Error saving file: " & Err.Description
    Response.Write "Error saving thumbnail."
Else
    LogMessage "Thumbnail saved successfully."
    Response.Write "Thumbnail saved successfully."
End If

' Clean up
binaryStream.Close
Set binaryStream = Nothing

' Function to decode base64
Function DecodeBase64(base64String)
    Set xml = CreateObject("MSXml2.DOMDocument.3.0")
    Set node = xml.CreateElement("base64")
    node.DataType = "bin.base64"
    node.Text = base64String
    DecodeBase64 = node.nodeTypedValue
    Set node = Nothing
    Set xml = Nothing
End Function

' Simple logging function to a file
Sub LogMessage(message)
    Dim fso, logFile, filePath
    Set fso = Server.CreateObject("Scripting.FileSystemObject")
    filePath = Server.MapPath("/logs/thumbnail_log.txt")
    
    If Not fso.FileExists(filePath) Then
        Set logFile = fso.CreateTextFile(filePath, True)
    Else
        Set logFile = fso.OpenTextFile(filePath, 8, True) ' Append mode
    End If
    
    logFile.WriteLine(Now() & " - " & message)
    logFile.Close
    Set logFile = Nothing
    Set fso = Nothing
End Sub
%>
