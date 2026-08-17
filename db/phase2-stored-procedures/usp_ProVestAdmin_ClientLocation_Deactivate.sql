-- Soft delete. IsActive already drives importer behaviour (GetClientIdForRecord
-- only considers active locations), so deactivating is the meaningful operation.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ClientLocation_Deactivate]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.ProVestClientLocation WITH (UPDLOCK, HOLDLOCK) WHERE Id = @Id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No ProVestClientLocation row found for the supplied id.', 1;
        END

        UPDATE dbo.ProVestClientLocation
        SET IsActive = 0
        WHERE Id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
