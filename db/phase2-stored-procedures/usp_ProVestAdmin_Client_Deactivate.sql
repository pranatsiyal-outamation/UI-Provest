-- Soft delete. ProVestClient has FK children (ProVestClientLocation, ProVestErrorLog),
-- so a hard DELETE would fail with 547. IsActive already drives importer behaviour.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Client_Deactivate]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.ProVestClient WITH (UPDLOCK, HOLDLOCK) WHERE Id = @Id)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No ProVestClient row found for the supplied id.', 1;
        END

        UPDATE dbo.ProVestClient
        SET IsActive = 0
        WHERE Id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
