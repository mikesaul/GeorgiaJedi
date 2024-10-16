<%
Option Explicit
Response.ContentType = "application/json"

Dim objFSO, objFolder, objFile, arrFiles, imageFolder, jsonArray
imageFolder = Server.MapPath("images/") ' Get the full path of the images folder
Set objFSO = Server.CreateObject("Scripting.FileSystemObject")
Set objFolder = objFSO.GetFolder(imageFolder)
Set arrFiles = Server.CreateObject("Scripting.Dictionary") ' Store the image file names

jsonArray = "["

' Iterate through the folder and get all image files
For Each objFile In objFolder.Files
    ' Check if the file is an image by matching its extension
    If LCase(Right(objFile.Name, 4)) = ".jpg" Or LCase(Right(objFile.Name, 5)) = ".jpeg" Or LCase(Right(objFile.Name, 4)) = ".png" Or LCase(Right(objFile.Name, 4)) = ".gif" Then
        arrFiles.Add objFile.Name, objFile.Name
    End If
Next

' Create JSON string from the dictionary of files
Dim key
For Each key In arrFiles.Keys
    jsonArray = jsonArray & """images/" & arrFiles.Item(key) & ""","
Next

' Remove the trailing comma and close the JSON array
If Len(jsonArray) > 1 Then
    jsonArray = Left(jsonArray, Len(jsonArray) - 1)
End If
jsonArray = jsonArray & "]"

' Output the JSON string
Response.Write jsonArray

' Clean up
Set objFile = Nothing
Set objFolder = Nothing
Set objFSO = Nothing
Set arrFiles = Nothing
%>
