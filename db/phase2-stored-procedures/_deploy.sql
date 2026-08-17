/*
    ProVest FM Admin Tool -- stored procedure deployment
    ====================================================

    Creates the 25 stored procedures the admin API calls. Every one is
    CREATE OR ALTER, so this script is safe to re-run.

    THIS IS A SCHEMA WRITE. It creates procedures in whichever database the
    connection targets. It does not read, modify, or delete any table data.

    HOW TO RUN
    ----------
    sqlcmd:
        sqlcmd -S <server> -d <database> -E -i _deploy.sql

    SSMS:
        Open this file, enable Query > SQLCMD Mode, connect to the target
        database, then execute. Without SQLCMD mode the :r directives below
        are syntax errors.

    No USE statement and no three-part names anywhere -- the target database
    is whatever the connection is pointed at.

    AFTERWARDS
    ----------
    Grant the application's login EXECUTE on these procedures and no
    table-level rights. That grant, not the C#, is what enforces
    "no arbitrary SQL, no arbitrary table access":

        GRANT EXECUTE ON SCHEMA::dbo TO [<app-login>];   -- too broad; prefer per-proc:
        GRANT EXECUTE ON OBJECT::dbo.usp_ProVestAdmin_Client_Search TO [<app-login>];
        ... one per procedure ...
*/

SET NOCOUNT ON;
PRINT 'Deploying ProVest Admin stored procedures to [' + DB_NAME() + ']...';
GO

-- ProVestClient -------------------------------------------------------------
:r usp_ProVestAdmin_Client_Search.sql
GO
:r usp_ProVestAdmin_Client_GetById.sql
GO
:r usp_ProVestAdmin_Client_Insert.sql
GO
:r usp_ProVestAdmin_Client_Update.sql
GO
:r usp_ProVestAdmin_Client_Deactivate.sql
GO

-- ProVestClientLocation -----------------------------------------------------
:r usp_ProVestAdmin_ClientLocation_Search.sql
GO
:r usp_ProVestAdmin_ClientLocation_GetById.sql
GO
:r usp_ProVestAdmin_ClientLocation_Insert.sql
GO
:r usp_ProVestAdmin_ClientLocation_Update.sql
GO
:r usp_ProVestAdmin_ClientLocation_Deactivate.sql
GO

-- ProVestColumnMapping (read-only + scoped regenerate) ----------------------
:r usp_ProVestAdmin_ColumnMapping_Search.sql
GO
:r usp_ProVestAdmin_ColumnMapping_RegenerateForImporter.sql
GO

-- Import_Update -------------------------------------------------------------
:r usp_ProVestAdmin_ImportUpdate_Search.sql
GO
:r usp_ProVestAdmin_ImportUpdate_GetById.sql
GO
:r usp_ProVestAdmin_ImportUpdate_Insert.sql
GO
:r usp_ProVestAdmin_ImportUpdate_Update.sql
GO
:r usp_ProVestAdmin_ImportUpdate_Delete.sql
GO

-- ImportFileHeader ----------------------------------------------------------
:r usp_ProVestAdmin_ImportFileHeader_Search.sql
GO
:r usp_ProVestAdmin_ImportFileHeader_GetById.sql
GO
:r usp_ProVestAdmin_ImportFileHeader_Insert.sql
GO
:r usp_ProVestAdmin_ImportFileHeader_Update.sql
GO
:r usp_ProVestAdmin_ImportFileHeader_Delete.sql
GO

-- Lookups -------------------------------------------------------------------
:r usp_ProVestAdmin_Lookup_StandardColumns.sql
GO
:r usp_ProVestAdmin_Lookup_ProjectSetups.sql
GO
:r usp_ProVestAdmin_Lookup_Clients.sql
GO

DECLARE @Count INT;
SELECT @Count = COUNT(*)
FROM sys.procedures
WHERE name LIKE 'usp_ProVestAdmin[_]%';

PRINT 'Done. usp_ProVestAdmin_* procedures present: ' + CAST(@Count AS VARCHAR(10)) + ' (expected 25).';
GO
