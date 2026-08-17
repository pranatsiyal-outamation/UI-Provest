CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportUpdate_Delete]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Matches INT;
        SELECT @Matches = COUNT(*)
        FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @Id;

        IF @Matches = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No Import_Update row found for the supplied id.', 1;
        END
        IF @Matches > 1
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51002, 'Import_Update.id is not unique; refusing to delete multiple rows.', 1;
        END

        DELETE FROM dbo.Import_Update WHERE id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
