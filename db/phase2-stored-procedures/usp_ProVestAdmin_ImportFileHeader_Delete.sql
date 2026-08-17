CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ImportFileHeader_Delete]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Matches INT;
        SELECT @Matches = COUNT(*)
        FROM dbo.ImportFileHeader WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @Id;

        IF @Matches = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No ImportFileHeader row found for the supplied id.', 1;
        END
        IF @Matches > 1
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51002, 'ImportFileHeader.id is not unique; refusing to delete multiple rows.', 1;
        END

        DELETE FROM dbo.ImportFileHeader WHERE id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
